#!/bin/bash
# SelfClaw One-Click Installation Script
# Install and configure SelfClaw on any Linux server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}
  #####  ######  #       ####   ####  #      #    # 
 #     # #     # #      #    # #    # #       #  #  
 #       #     # #      #    # #    # #        ##   
  #####  ######  #      #    # #    # #        ##   
       # #        #      #    # #    # #       #  #  
 #     # #        #      #    # #    # #      #    # 
  #####  #        ######  ####   ####  ###### #    # 
                                                     
Self-Evolving Agent Framework - One-Click Installer
${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Warning: Not running as root. Some operations may require sudo.${NC}"
    SUDO="sudo"
else
    SUDO=""
fi

# Configuration variables
INSTALL_DIR="${INSTALL_DIR:-/opt/selfclaw}"
DOMAIN="${DOMAIN:-}"
WITH_SSL="${WITH_SSL:-false}"
WITH_MONITORING="${WITH_MONITORING:-false}"

# Print step message
print_step() {
    echo -e "\n${BLUE}=> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}! $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check system requirements
check_requirements() {
    print_step "Checking system requirements..."

    # Check OS
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "This installer only supports Linux systems"
        exit 1
    fi

    # Check memory (minimum 2GB)
    MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$MEM_TOTAL" -lt 2000 ]; then
        print_warning "System has less than 2GB RAM. Performance may be limited."
    fi

    print_success "System requirements check passed"
}

# Install Docker
install_docker() {
    print_step "Installing Docker..."

    if command -v docker &> /dev/null; then
        print_success "Docker is already installed: $(docker --version)"
        return
    fi

    # Install Docker based on package manager
    if command -v apt-get &> /dev/null; then
        $SUDO apt-get update
        $SUDO apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
        $SUDO apt-get update
        $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io
    elif command -v yum &> /dev/null; then
        $SUDO yum install -y yum-utils
        $SUDO yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        $SUDO yum install -y docker-ce docker-ce-cli containerd.io
    else
        print_error "Unsupported package manager. Please install Docker manually."
        exit 1
    fi

    # Start and enable Docker
    $SUDO systemctl start docker
    $SUDO systemctl enable docker

    print_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    print_step "Installing Docker Compose..."

    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        print_success "Docker Compose is already installed"
        return
    fi

    # Install Docker Compose plugin
    DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
    mkdir -p "$DOCKER_CONFIG/cli-plugins"
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
    chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"

    print_success "Docker Compose installed successfully"
}

# Clone or copy SelfClaw files
install_selfclaw() {
    print_step "Installing SelfClaw files..."

    # Create installation directory
    $SUDO mkdir -p "$INSTALL_DIR"
    $SUDO chown -R "$(whoami):$(whoami)" "$INSTALL_DIR"

    # If running from git repo, copy files
    if [ -d ".git" ] && [ -f "package.json" ]; then
        cp -r . "$INSTALL_DIR/"
    else
        # Clone from GitHub (placeholder URL)
        git clone https://github.com/selfclaw/selfclaw.git "$INSTALL_DIR" 2>/dev/null || {
            print_warning "Git clone failed. Using local files."
            mkdir -p "$INSTALL_DIR"
        }
    fi

    # Create required directories
    mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/logs" "$INSTALL_DIR/ssl"

    # Create environment file if it doesn't exist
    if [ ! -f "$INSTALL_DIR/.env" ]; then
        JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
        cat > "$INSTALL_DIR/.env" << EOF
# SelfClaw Environment Configuration
# Generated on: $(date)

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Security
JWT_SECRET=$JWT_SECRET

# Logging
LOG_LEVEL=info

# Monitoring (Optional)
GRAFANA_USER=admin
GRAFANA_PASSWORD=$(openssl rand -hex 8 2>/dev/null || head -c 8 /dev/urandom | xxd -p -c 8)
EOF
        print_success "Generated secure environment configuration"
    fi

    print_success "SelfClaw files installed to $INSTALL_DIR"
}

# Configure systemd service
configure_systemd() {
    print_step "Configuring systemd service..."

    cat > /tmp/selfclaw.service << EOF
[Unit]
Description=SelfClaw Self-Evolving Agent Framework
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose -f docker/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f docker/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    $SUDO mv /tmp/selfclaw.service /etc/systemd/system/
    $SUDO systemctl daemon-reload
    $SUDO systemctl enable selfclaw

    print_success "Systemd service configured"
}

# Start SelfClaw
start_selfclaw() {
    print_step "Starting SelfClaw services..."

    cd "$INSTALL_DIR"

    # Build and start containers
    if [ "$WITH_MONITORING" = "true" ]; then
        docker compose -f docker/docker-compose.yml --profile monitoring up -d --build
    else
        docker compose -f docker/docker-compose.yml up -d --build
    fi

    # Wait for services to be ready
    echo "Waiting for services to start..."
    sleep 30

    # Check if services are running
    if docker compose -f docker/docker-compose.yml ps | grep -q "healthy"; then
        print_success "SelfClaw services started successfully"
    else
        print_warning "Services may still be starting. Check with 'docker compose ps'"
    fi
}

# Setup SSL certificate
setup_ssl() {
    if [ "$WITH_SSL" != "true" ] || [ -z "$DOMAIN" ]; then
        return
    fi

    print_step "Setting up SSL certificate for $DOMAIN..."

    # Install certbot
    if command -v apt-get &> /dev/null; then
        $SUDO apt-get install -y certbot
    elif command -v yum &> /dev/null; then
        $SUDO yum install -y certbot
    fi

    # Obtain certificate (standalone mode)
    $SUDO certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" 2>/dev/null || {
        print_warning "SSL certificate setup failed. Skipping..."
        return
    }

    # Copy certificates to ssl directory
    $SUDO cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$INSTALL_DIR/ssl/"
    $SUDO cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$INSTALL_DIR/ssl/"
    $SUDO chown -R "$(whoami):$(whoami)" "$INSTALL_DIR/ssl/"

    print_success "SSL certificate configured"
}

# Display installation summary
show_summary() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}   SelfClaw Installation Complete!   ${NC}"
    echo -e "${GREEN}========================================${NC}\n"

    echo -e "Installation Directory: ${BLUE}$INSTALL_DIR${NC}"
    echo -e "Web Interface: ${BLUE}http://$(hostname -I | awk '{print $1}')${NC}"
    if [ -n "$DOMAIN" ]; then
        echo -e "Domain: ${BLUE}https://$DOMAIN${NC}"
    fi
    echo -e "Default Username: ${YELLOW}admin${NC}"
    echo -e "Default Password: ${YELLOW}admin123${NC}\n"

    echo -e "Useful Commands:"
    echo -e "  Start SelfClaw:   ${BLUE}$SUDO systemctl start selfclaw${NC}"
    echo -e "  Stop SelfClaw:    ${BLUE}$SUDO systemctl stop selfclaw${NC}"
    echo -e "  View Status:      ${BLUE}cd $INSTALL_DIR && docker compose ps${NC}"
    echo -e "  View Logs:        ${BLUE}cd $INSTALL_DIR && docker compose logs -f${NC}\n"

    echo -e "${YELLOW}Important:${NC} Change the default password immediately after login!"
}

# Main installation flow
main() {
    check_requirements
    install_docker
    install_docker_compose
    install_selfclaw
    configure_systemd
    setup_ssl
    start_selfclaw
    show_summary
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            WITH_SSL=true
            shift 2
            ;;
        --with-monitoring)
            WITH_MONITORING=true
            shift
            ;;
        --no-ssl)
            WITH_SSL=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main installation
main
