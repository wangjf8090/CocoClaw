# SelfClaw Deployment Guide

This guide will help you deploy SelfClaw on your server.

## 📋 Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- **CPU**: Minimum 2 cores, recommended 4+ cores
- **RAM**: Minimum 2GB, recommended 4GB+
- **Storage**: Minimum 10GB SSD

### Software Requirements
- Docker 20.10+
- Docker Compose v2+
- Git (optional, for cloning the repository)

## 🚀 Quick Start (One-Click Install)

### Option 1: Using the Install Script

```bash
# Download the install script
curl -fsSL https://raw.githubusercontent.com/selfclaw/selfclaw/main/scripts/install.sh -o install-selfclaw.sh

# Make it executable
chmod +x install-selfclaw.sh

# Run the installer
sudo ./install-selfclaw.sh
```

### Option 2: Custom Installation

```bash
# With custom domain and SSL
sudo DOMAIN=selfclaw.yourdomain.com WITH_SSL=true ./install.sh

# With monitoring stack
sudo WITH_MONITORING=true ./install.sh

# Custom install directory
sudo INSTALL_DIR=/home/user/selfclaw ./install.sh
```

## 🐳 Manual Docker Deployment

### Step 1: Clone the Repository

```bash
git clone https://github.com/selfclaw/selfclaw.git
cd selfclaw
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit the environment file
nano .env
```

**Important**: Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

### Step 3: Start Services

```bash
# Basic deployment
docker compose -f docker/docker-compose.yml up -d --build

# With monitoring (Prometheus + Grafana)
docker compose -f docker/docker-compose.yml --profile monitoring up -d --build
```

### Step 4: Verify Installation

```bash
# Check service status
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Test health endpoint
curl http://localhost:3000/health
```

## 🌐 Nginx Reverse Proxy Configuration

### Basic Configuration

The Docker deployment includes a pre-configured Nginx reverse proxy that:
- Serves the frontend static files
- Proxies API requests to the backend
- Handles WebSocket connections
- Provides security headers
- Enables Gzip compression

### SSL Configuration

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install -y certbot  # Ubuntu/Debian
sudo yum install -y certbot       # CentOS/RHEL

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/

# Restart services
docker compose -f docker/docker-compose.yml restart frontend
```

#### Option B: Custom SSL Certificate

```bash
# Place your certificates in the ssl directory
cp your-cert.pem ./ssl/fullchain.pem
cp your-key.pem ./ssl/privkey.pem
```

## 🔧 Systemd Service

### Install as System Service

```bash
# Create service file
sudo tee /etc/systemd/system/selfclaw.service << 'EOF'
[Unit]
Description=SelfClaw Self-Evolving Agent Framework
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/selfclaw
ExecStart=/usr/bin/docker compose -f docker/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f docker/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable selfclaw
sudo systemctl start selfclaw
```

### Service Management

```bash
# Start SelfClaw
sudo systemctl start selfclaw

# Stop SelfClaw
sudo systemctl stop selfclaw

# Restart SelfClaw
sudo systemctl restart selfclaw

# Check status
sudo systemctl status selfclaw

# View logs
journalctl -u selfclaw -f
```

## 📊 Monitoring Setup

### Enable Monitoring Stack

```bash
# Start with monitoring profile
docker compose -f docker/docker-compose.yml --profile monitoring up -d
```

### Access Monitoring Tools

- **Prometheus**: http://your-server:9090
- **Grafana**: http://your-server:3001
  - Default username: `admin`
  - Default password: `admin` (change in .env)

### Configure Grafana Dashboard

1. Login to Grafana
2. Add Prometheus as a data source (URL: `http://prometheus:9090`)
3. Import dashboards from the `docs/grafana/` directory

## 🔐 Security Configuration

### Change Default Passwords

1. Login to the web interface with `admin / admin123`
2. Go to Settings → User Management
3. Change the admin password

### Firewall Configuration

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Restrict Monitoring Ports (Optional)

```bash
# Only allow localhost to access monitoring ports
sudo ufw allow in from 127.0.0.1 to any port 9090  # Prometheus
sudo ufw allow in from 127.0.0.1 to any port 3001  # Grafana
```

## 🔄 Updating SelfClaw

### Automated Update

```bash
# Use the update script
./scripts/update.sh
```

### Manual Update

```bash
# 1. Backup data
docker compose exec -T backend tar czf - /app/data > backup-data.tar.gz

# 2. Stop services
docker compose -f docker/docker-compose.yml down

# 3. Pull latest changes
git pull origin main

# 4. Rebuild and start
docker compose -f docker/docker-compose.yml up -d --build
```

## 📁 Directory Structure

```
/opt/selfclaw/
├── data/                  # Application data
│   ├── soul/             # SOUL module data
│   └── memory/           # Memory module data
├── logs/                 # Log files
├── ssl/                  # SSL certificates
├── packages/             # Source code
│   ├── soul/             # SOUL module
│   ├── ui/backend/       # Backend API
│   └── ui/frontend/      # Frontend UI
├── docker/               # Docker configuration
└── scripts/              # Utility scripts
```

## 🔍 Troubleshooting

### Services Not Starting

```bash
# Check container logs
docker compose -f docker/docker-compose.yml logs backend
docker compose -f docker/docker-compose.yml logs frontend

# Check container status
docker compose -f docker/docker-compose.yml ps

# Restart problematic service
docker compose -f docker/docker-compose.yml restart backend
```

### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R 1000:1000 ./data
sudo chmod -R 755 ./data
```

### Connection Refused

```bash
# Check if ports are in use
sudo netstat -tlnp | grep -E ':(80|443|3000|9090|3001)'

# Check firewall status
sudo ufw status
sudo firewall-cmd --list-all
```

### Memory Issues

```bash
# Check memory usage
docker stats

# Increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review the logs: `docker compose logs -f`
3. Search existing GitHub Issues
4. Create a new issue with:
   - OS version
   - Docker version
   - Error messages
   - Steps to reproduce

## 📚 Additional Resources

- [Validation Report](./VALIDATION_REPORT.md)
- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Monitoring Guide](./MONITORING.md)
