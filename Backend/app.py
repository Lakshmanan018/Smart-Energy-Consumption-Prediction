from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tensorflow as tf
import joblib
import numpy as np
import pandas as pd
import os
import uvicorn
from typing import List, Union

# --- Configuration ---
folder_path = "."  # Current directory
scaler_path = "scaler.pkl"
target_scaler_inverse_path = "target_scaler_for_inverse.pkl"

# --- Load Model and Scalers ---
loaded_lstm_model = None
loaded_scaler = None
target_scaler_for_inverse = None

try:
    model_file = os.path.join(folder_path, "energy_lstm_model.keras")
    print(f"Looking for model at: {model_file}")
    loaded_lstm_model = tf.keras.models.load_model(model_file)

    print(f"Looking for scaler at: {scaler_path}")
    loaded_scaler = joblib.load(scaler_path)

    print(f"Looking for target scaler at: {target_scaler_inverse_path}")
    target_scaler_for_inverse = joblib.load(target_scaler_inverse_path)

    print("✅ Model and scalers loaded successfully!")
except Exception as e:
    print(f"❌ Error loading model or scalers: {e}")

# Define input features and n_steps
features_for_prediction = [
    'Temperature', 'Humidity', 'WindSpeed', 'GeneralDiffuseFlows', 'DiffuseFlows',
    'lag_1', 'lag_6', 'lag_144', 'lag_1008', 'TotalConsumption'
]
lstm_n_steps = 10

# --- FastAPI App ---
app = FastAPI(title="Smart Energy Prediction API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request body for prediction
class PredictionRequest(BaseModel):
    sequence: List[dict]  # List of observations
    # Optional: allow single record
    record: dict = None

@app.get("/")
def home():
    return {"message": "Smart Energy Prediction API is running"}

@app.get("/health")
def health():
    return {"status": "OK", "model_loaded": loaded_lstm_model is not None}

@app.post("/predict")
def predict(request: PredictionRequest):
    if loaded_lstm_model is None or loaded_scaler is None or target_scaler_for_inverse is None:
        raise HTTPException(status_code=500, detail="Model or scalers not loaded. Check server logs.")

    try:
        # Handle both single record and sequence
        if request.record is not None:
            # Single record mode - replicate it to create a sequence
            # Use the single record 10 times (you can also use padding or other methods)
            sequence_data = [request.record] * lstm_n_steps
        elif request.sequence and len(request.sequence) > 0:
            # Sequence mode - use as is
            sequence_data = request.sequence
        else:
            raise ValueError("No data provided. Please provide either 'record' or 'sequence'.")

        # If we have a single record, replicate it to 10 observations
        if len(sequence_data) == 1:
            # Option 1: Replicate the single record 10 times
            sequence_data = sequence_data * lstm_n_steps
            print(f"⚠️ Single record detected. Replicated {lstm_n_steps} times for prediction.")

        # Convert input sequence to DataFrame
        input_df = pd.DataFrame(sequence_data)

        # Ensure column order matches the training data for scaling
        input_df = input_df[features_for_prediction]

        # Scale the input sequence
        scaled_input = loaded_scaler.transform(input_df)

        # Reshape for LSTM: (1, n_steps, n_features)
        if scaled_input.shape[0] != lstm_n_steps:
            # If we have more than needed, take the last n_steps
            if scaled_input.shape[0] > lstm_n_steps:
                scaled_input = scaled_input[-lstm_n_steps:]
            else:
                raise ValueError(f"Input sequence must contain at least {lstm_n_steps} observations, but got {scaled_input.shape[0]}.")

        prediction_input = scaled_input.reshape(1, lstm_n_steps, len(features_for_prediction))

        # Make prediction
        scaled_prediction = loaded_lstm_model.predict(prediction_input)

        # Inverse transform the prediction
        predicted_total_consumption = target_scaler_for_inverse.inverse_transform(scaled_prediction)[0][0]

        return {
            "predicted_total_consumption": float(predicted_total_consumption),
            "input_shape": scaled_input.shape,
            "message": "Prediction successful"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/predict-single")
def predict_single(record: dict):
    """Endpoint specifically for single record predictions"""
    if loaded_lstm_model is None or loaded_scaler is None or target_scaler_for_inverse is None:
        raise HTTPException(status_code=500, detail="Model or scalers not loaded.")

    try:
        # Validate required fields
        required_fields = features_for_prediction
        missing_fields = [f for f in required_fields if f not in record]
        if missing_fields:
            raise ValueError(f"Missing required fields: {missing_fields}")

        # Create sequence by replicating the single record 10 times
        sequence_data = [record] * lstm_n_steps

        # Convert to DataFrame
        input_df = pd.DataFrame(sequence_data)
        input_df = input_df[features_for_prediction]

        # Scale and predict
        scaled_input = loaded_scaler.transform(input_df)
        prediction_input = scaled_input.reshape(1, lstm_n_steps, len(features_for_prediction))
        scaled_prediction = loaded_lstm_model.predict(prediction_input)
        predicted_total_consumption = target_scaler_for_inverse.inverse_transform(scaled_prediction)[0][0]

        return {
            "predicted_total_consumption": float(predicted_total_consumption),
            "status": "success"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
