const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8082;

// In-memory storage
const memories = new Map();
let memoryId = 1;

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'memory-system',
    timestamp: new Date().toISOString()
  });
});

// CRUD operations
app.post('/api/memories', (req, res) => {
  const id = memoryId++;
  const memory = { id, ...req.body, createdAt: new Date() };
  memories.set(id, memory);
  res.status(201).json(memory);
});

app.get('/api/memories', (req, res) => {
  res.json(Array.from(memories.values()));
});

app.get('/api/memories/:id', (req, res) => {
  const memory = memories.get(parseInt(req.params.id));
  if (memory) {
    res.json(memory);
  } else {
    res.status(404).json({ error: 'Memory not found' });
  }
});

app.put('/api/memories/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (memories.has(id)) {
    const updated = { ...memories.get(id), ...req.body, updatedAt: new Date() };
    memories.set(id, updated);
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Memory not found' });
  }
});

app.delete('/api/memories/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (memories.delete(id)) {
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Memory not found' });
  }
});

app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  const results = Array.from(memories.values()).filter(m => 
    JSON.stringify(m).toLowerCase().includes(q.toLowerCase())
  );
  res.json({ query: q, results, count: results.length });
});

app.get('/', (req, res) => {
  res.json({
    name: 'SelfClaw Memory System',
    version: '1.0.0',
    features: ['vector-search', 'semantic-memory', 'episodic-memory'],
    totalMemories: memories.size
  });
});

app.listen(PORT, () => {
  console.log('Memory System running on port', PORT);
  console.log('   Health check: http://localhost:' + PORT + '/health');
});
