// app.js - EnergyAI Predictor

// ===== Configuration =====
const API_BASE = 'http://127.0.0.1:8000';
const PREDICT_ENDPOINT = `${API_BASE}/predict`;
const HEALTH_ENDPOINT = `${API_BASE}/health`;

// ===== DOM Elements =====
const predictBtn = document.getElementById('predictBtn');
const clearBtn = document.getElementById('clearBtn');
const sampleBtn = document.getElementById('sampleBtn');
const resultContainer = document.getElementById('resultContainer');
const loadingState = document.getElementById('loadingState');
const errorContainer = document.getElementById('errorContainer');
const resultValue = document.getElementById('resultValue');
const errorMessage = document.getElementById('errorMessage');
const timestamp = document.getElementById('timestamp');
const progressFill = document.getElementById('progressFill');
const statusIndicator = document.querySelector('.status-indicator');
const statusPulse = document.querySelector('.status-pulse');
const statusLabel = document.querySelector('.status-label');

// Input Fields
const inputs = {
  temperature: document.getElementById('temperature'),
  humidity: document.getElementById('humidity'),
  windspeed: document.getElementById('windspeed'),
  gdf: document.getElementById('gdf'),
  df: document.getElementById('df'),
  lag1: document.getElementById('lag1'),
  lag6: document.getElementById('lag6'),
  lag144: document.getElementById('lag144'),
  lag1008: document.getElementById('lag1008'),
  total: document.getElementById('total')
};

// ===== Sample Data =====
const sampleData = {
  temperature: 25.5,
  humidity: 65.0,
  windspeed: 3.2,
  gdf: 180,
  df: 85,
  lag1: 32000,
  lag6: 31500,
  lag144: 31000,
  lag1008: 30500,
  total: 68000
};

// ===== Utility Functions =====
function getInputData() {
  const temp = parseFloat(inputs.temperature.value);
  const humidity = parseFloat(inputs.humidity.value);
  const wind = parseFloat(inputs.windspeed.value);
  const gdf = parseFloat(inputs.gdf.value);
  const df = parseFloat(inputs.df.value);
  const lag1 = parseFloat(inputs.lag1.value);
  const lag6 = parseFloat(inputs.lag6.value);
  const lag144 = parseFloat(inputs.lag144.value);
  const lag1008 = parseFloat(inputs.lag1008.value);
  const total = parseFloat(inputs.total.value) || 0;

  if ([temp, humidity, wind, gdf, df, lag1, lag6, lag144, lag1008].some(isNaN)) {
    return null;
  }

  return {
    Temperature: temp,
    Humidity: humidity,
    WindSpeed: wind,
    GeneralDiffuseFlows: gdf,
    DiffuseFlows: df,
    lag_1: lag1,
    lag_6: lag6,
    lag_144: lag144,
    lag_1008: lag1008,
    TotalConsumption: total
  };
}

function fillForm(data) {
  Object.keys(inputs).forEach(key => {
    const input = inputs[key];
    if (data[key] !== undefined) {
      input.value = data[key];
      input.style.borderColor = 'rgba(108, 99, 255, 0.3)';
    }
  });
}

function clearForm() {
  Object.values(inputs).forEach(input => {
    input.value = '';
    input.style.borderColor = '';
  });
  hideResults();
}

function hideResults() {
  resultContainer.style.display = 'none';
  errorContainer.style.display = 'none';
  loadingState.style.display = 'none';
}

function showLoading() {
  hideResults();
  loadingState.style.display = 'flex';
  progressFill.style.width = '0%';
  setTimeout(() => { progressFill.style.width = '60%'; }, 300);
  setTimeout(() => { progressFill.style.width = '85%'; }, 800);
}

function showResult(value) {
  loadingState.style.display = 'none';
  errorContainer.style.display = 'none';
  resultContainer.style.display = 'block';
  resultValue.textContent = value.toFixed(2);
  timestamp.textContent = new Date().toLocaleString();
  progressFill.style.width = '100%';

  // Trigger confetti or celebration effect
  if (value > 0) {
    createMiniCelebration();
  }
}

function showError(message) {
  loadingState.style.display = 'none';
  resultContainer.style.display = 'none';
  errorContainer.style.display = 'block';
  errorMessage.textContent = message;
}

function updateStatus(isOnline) {
  if (isOnline) {
    statusLabel.textContent = 'Online';
    statusPulse.className = 'status-pulse';
    predictBtn.disabled = false;
  } else {
    statusLabel.textContent = 'Offline';
    statusPulse.className = 'status-pulse offline';
    predictBtn.disabled = true;
  }
}

function createMiniCelebration() {
  // Simple visual feedback
  const container = document.querySelector('.result-value');
  if (container) {
    container.style.transform = 'scale(1.05)';
    setTimeout(() => { container.style.transform = 'scale(1)'; }, 300);
  }
}

// ===== API Calls =====
async function checkHealth() {
  try {
    const response = await fetch(HEALTH_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log('✅ Backend health check:', data);
    updateStatus(true);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    updateStatus(false);
  }
}

async function predictWithSequence(data) {
  const sequence = Array(10).fill(data);

  const response = await fetch(PREDICT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence: sequence }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

// ===== Main Prediction Handler =====
async function handlePrediction() {
  const inputData = getInputData();
  if (!inputData) {
    showError('Please fill in all required fields with valid numbers.');
    return;
  }

  showLoading();

  try {
    const result = await predictWithSequence(inputData);

    if (result.predicted_total_consumption !== undefined) {
      showResult(result.predicted_total_consumption);
    } else {
      showError('Unexpected response from server.');
    }
  } catch (error) {
    console.error('Prediction failed:', error);
    showError(error.message || 'Failed to get prediction. Please try again.');
  }
}

// ===== Event Listeners =====
predictBtn.addEventListener('click', handlePrediction);

clearBtn.addEventListener('click', clearForm);

sampleBtn.addEventListener('click', () => {
  fillForm(sampleData);
  hideResults();
  // Highlight the filled fields
  Object.values(inputs).forEach(input => {
    if (input.value) {
      input.style.borderColor = 'rgba(0, 230, 118, 0.3)';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
    }
  });
});

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const active = document.activeElement;
    if (active && active.tagName === 'INPUT' && active.closest('.form-group')) {
      handlePrediction();
    }
  }
});

// Input validation with visual feedback
Object.values(inputs).forEach(input => {
  input.addEventListener('focus', () => {
    input.parentElement.parentElement.style.borderColor = 'rgba(108, 99, 255, 0.2)';
  });
  input.addEventListener('blur', () => {
    input.parentElement.parentElement.style.borderColor = '';
    if (input.value && !isNaN(input.value)) {
      input.style.borderColor = 'rgba(0, 230, 118, 0.2)';
    }
  });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Mobile toggle
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.querySelector('.nav-links').classList.toggle('open');
});

// ===== Particles Effect =====
function createParticles() {
  const container = document.getElementById('particles');
  const count = 30;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    const size = Math.random() * 4 + 2;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const duration = Math.random() * 20 + 15;
    const delay = Math.random() * 10;

    particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: rgba(108, 99, 255, 0.15);
            border-radius: 50%;
            left: ${x}%;
            top: ${y}%;
            animation: float-particle ${duration}s ease-in-out infinite;
            animation-delay: ${delay}s;
        `;
    container.appendChild(particle);
  }
}

// Add floating animation keyframes dynamically
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes float-particle {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
        25% { transform: translate(30px, -20px) scale(1.2); opacity: 0.6; }
        50% { transform: translate(-10px, 30px) scale(0.8); opacity: 0.3; }
        75% { transform: translate(20px, 10px) scale(1.1); opacity: 0.5; }
    }
`;
document.head.appendChild(styleSheet);

// ===== Initialize =====
createParticles();
checkHealth();

console.log('⚡ EnergyAI Predictor loaded successfully!');
console.log('📊 Enter your data and click "Predict Now"');