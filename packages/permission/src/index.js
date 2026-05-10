const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8083;
const JWT_SECRET = process.env.JWT_SECRET || 'selfclaw-secret';

// Roles and permissions
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  USER: 'user',
  GUEST: 'guest'
};

const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.ADMIN]: ['user:*', 'agent:*', 'config:read'],
  [ROLES.DEVELOPER]: ['agent:*', 'config:read'],
  [ROLES.USER]: ['agent:read', 'memory:*'],
  [ROLES.GUEST]: ['agent:read']
};

const users = new Map();
users.set(1, { id: 1, username: 'admin', role: ROLES.SUPER_ADMIN });

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'permission-system',
    timestamp: new Date().toISOString()
  });
});

// Generate token
app.post('/api/token', (req, res) => {
  const { userId, role } = req.body;
  const token = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, expiresIn: 86400 });
});

// Verify token
app.post('/api/verify', (req, res) => {
  try {
    const decoded = jwt.verify(req.body.token, JWT_SECRET);
    res.json({ valid: true, payload: decoded });
  } catch (e) {
    res.json({ valid: false, error: e.message });
  }
});

// Check permission
app.post('/api/check', (req, res) => {
  const { role, permission } = req.body;
  const rolePerms = PERMISSIONS[role] || [];
  const hasPermission = rolePerms.includes('*') || rolePerms.includes(permission);
  res.json({ role, permission, allowed: hasPermission });
});

// Get all roles
app.get('/api/roles', (req, res) => {
  res.json({ roles: Object.values(ROLES), permissions: PERMISSIONS });
});

app.get('/', (req, res) => {
  res.json({
    name: 'SelfClaw Permission System',
    version: '1.0.0',
    features: ['7-layer RBAC', 'JWT authentication', 'fine-grained permissions'],
    roles: Object.values(ROLES)
  });
});

app.listen(PORT, () => {
  console.log('Permission System running on port', PORT);
  console.log('   Health check: http://localhost:' + PORT + '/health');
});
