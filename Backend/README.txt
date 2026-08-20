SMART ENERGY FRONTEND

Files:
  index.html
  style.css
  app.js

Backend expected at:
  http://127.0.0.1:8001

Backend endpoints:
  GET  /health
  POST /predict

1) Put this frontend folder next to your Flask backend folder.

2) Start Flask:
   python app.py

3) From this frontend folder, run:
   python -m http.server 5500

4) Open:
   http://127.0.0.1:5500

The frontend sends exactly 10 observations with these features:
Temperature
Humidity
WindSpeed
GeneralDiffuseFlows
DiffuseFlows
lag_1
lag_6
lag_144
lag_1008
TotalConsumption

For deployment, change API_BASE in app.js from:
http://127.0.0.1:8001
to your deployed Flask HTTPS URL.
