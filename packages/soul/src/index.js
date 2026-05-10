const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8085;

// Personality configurations
const PERSONALITIES = {
  creative: {
    name: 'Creative Explorer',
    traits: ['curious', 'imaginative', 'playful'],
    mood: 'excited',
    energy: 0.9
  },
  analytical: {
    name: 'Analytical Thinker',
    traits: ['logical', 'precise', 'thorough'],
    mood: 'focused',
    energy: 0.7
  },
  friendly: {
    name: 'Friendly Companion',
    traits: ['warm', 'supportive', 'empathic'],
    mood: 'happy',
    energy: 0.85
  },
  professional: {
    name: 'Professional Assistant',
    traits: ['efficient', 'reliable', 'formal'],
    mood: 'neutral',
    energy: 0.75
  },
  default: {
    name: 'Default',
    traits: ['balanced', 'adaptable'],
    mood: 'neutral',
    energy: 0.8
  }
};

let currentPersonality = PERSONALITIES.default;
let emotionalState = { mood: 'neutral', intensity: 0.5, arousal: 0.5 };

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'soul-module',
    timestamp: new Date().toISOString()
  });
});

// Get current personality
app.get('/api/personality', (req, res) => {
  res.json({
    current: currentPersonality,
    emotionalState,
    available: Object.keys(PERSONALITIES)
  });
});

// Set personality
app.post('/api/personality', (req, res) => {
  const personalityType = req.body.type || 'default';
  if (PERSONALITIES[personalityType]) {
    currentPersonality = PERSONALITIES[personalityType];
    res.json({
      success: true,
      personality: currentPersonality
    });
  } else {
    res.status(400).json({ error: 'Unknown personality type' });
  }
});

// Get emotional state
app.get('/api/emotion', (req, res) => {
  emotionalState.arousal = Math.max(0.1, Math.min(1, emotionalState.arousal + (Math.random() - 0.5) * 0.1));
  res.json(emotionalState);
});

// Update emotional state
app.post('/api/emotion', (req, res) => {
  emotionalState = { ...emotionalState, ...req.body };
  res.json(emotionalState);
});

// Generate response with personality
app.post('/api/generate', (req, res) => {
  const input = req.body.input || '';
  const response = {
    personality: currentPersonality.name,
    mood: emotionalState.mood,
    input,
    response: 'As a ' + currentPersonality.name + ', I am processing your input: "' + input + '" with a ' + emotionalState.mood + ' mood.',
    style: currentPersonality.traits
  };
  res.json(response);
});

// Get all personalities
app.get('/api/personalities', (req, res) => {
  res.json(PERSONALITIES);
});

app.get('/', (req, res) => {
  res.json({
    name: 'SelfClaw SOUL Module',
    version: '1.0.0',
    features: ['personality', 'emotional-state', 'behavior-modeling'],
    currentPersonality: currentPersonality.name
  });
});

app.listen(PORT, () => {
  console.log('SOUL Module running on port', PORT);
  console.log('   Health check: http://localhost:' + PORT + '/health');
});
