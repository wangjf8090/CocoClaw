const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8081;

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'query-engine',
    timestamp: new Date().toISOString()
  });
});

// Stream query endpoint
app.post('/api/query', (req, res) => {
  const query = req.body.query || '';
  
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  const tokens = [
    'Processing ', 'your ', 'query: ', '"', query, '"\n',
    'This ', 'is ', 'a ', 'streaming ', 'response ',
    'from ', 'the ', 'SelfClaw ', 'QueryEngine. ',
    'Each ', 'token ', 'is ', 'sent ', 'in ', 'real-time. ',
    '[OK] ', 'Query ', 'completed ', 'successfully!'
  ];
  
  let index = 0;
  const interval = setInterval(() => {
    if (index < tokens.length) {
      res.write(tokens[index]);
      index++;
    } else {
      clearInterval(interval);
      res.end();
    }
  }, 50);
});

app.get('/', (req, res) => {
  res.json({
    name: 'SelfClaw Query Engine',
    version: '1.0.0',
    features: ['streaming', 'llm-integration', 'tool-use']
  });
});

app.listen(PORT, () => {
  console.log('Query Engine running on port', PORT);
  console.log('   Health check: http://localhost:' + PORT + '/health');
});
