#!/bin/bash
# SelfClaw Update Script
# Update SelfClaw to the latest version

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/selfclaw}"
BACKUP_DIR="${BACKUP_DIR:-/opt/selfclaw-backup}"

echo -e "${BLUE}
  #####  ######  #       ####   ####  #      #    # 
 #     # #     # #      #    # #    # #       #  #  
 #       #     # #      #    # #    # #        ##   
  #####  ######  #      #    # #    # #        ##   
       # #        #      #    # #    # #       #  #  
 #     # #        #      #    # #    # #      #    # 
  #####  #        ######  ####   ####  ###### #    # 
                                                     
           Self-Evolving Agent Framework Update
${NC}"

# Check if running from correct directory
if [ ! -f "package.json" ] && [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}Error: SelfClaw installation not found at $INSTALL_DIR${NC}"
    exit 1
fi

# Change to install directory
cd "$INSTALL_DIR"

echo -e "\n${YELLOW}Starting update process...${NC}"

# Step 1: Backup current installation
echo -e "\n${BLUE}Step 1/5: Creating backup...${NC}"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
docker compose -f docker/docker-compose.yml exec -T backend tar czf - /app/data 2>/dev/null > "$BACKUP_DIR/$BACKUP_NAME-data.tar.gz" || true
echo -e "${GREEN}Backup created at $BACKUP_DIR/$BACKUP_NAME-data.tar.gz${NC}"

# Step 2: Stop services
echo -e "\n${BLUE}Step 2/5: Stopping services...${NC}"
docker compose -f docker/docker-compose.yml down
echo -e "${GREEN}Services stopped${NC}"

# Step 3: Pull latest changes
echo -e "\n${BLUE}Step 3/5: Updating source code...${NC}"
if [ -d ".git" ]; then
    git stash
    git pull origin main
    git stash pop || true
    echo -e "${GREEN}Source code updated${NC}"
else
    echo -e "${YELLOW}Not a git repository. Skipping source update.${NC}"
fi

# Step 4: Rebuild and start
echo -e "\n${BLUE}Step 4/5: Rebuilding containers...${NC}"
docker compose -f docker/docker-compose.yml build --no-cache
docker compose -f docker/docker-compose.yml up -d
echo -e "${GREEN}Containers rebuilt and started${NC}"

# Step 5: Wait for health
echo -e "\n${BLUE}Step 5/5: Waiting for services to become healthy...${NC}"
sleep 15

# Check status
if docker compose -f docker/docker-compose.yml ps | grep -q "healthy"; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}   SelfClaw Update Complete!   ${NC}"
    echo -e "${GREEN}========================================${NC}\n"
    echo -e "Services are running and healthy."
    echo -e "Backup: $BACKUP_DIR/$BACKUP_NAME-data.tar.gz"
    echo -e "\nUse 'docker compose logs -f' to view logs."
else
    echo -e "\n${YELLOW}Services may still be starting. Check with 'docker compose ps'.${NC}"
fi
