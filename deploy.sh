#!/bin/bash

# Configuration
LOG_FILE="/var/log/fairarena-deploy.log"

# Check if running in background mode
if [ "${1:-}" != "--background" ]; then
    nohup "$0" --background "$@" > /dev/null 2>&1 &
    echo "Deployment started in background. Check logs at $LOG_FILE. Run tail -n 50 /var/log/fairarena-deploy.log with sudo privileges to see the latest logs."
    exit 0
fi
# Shift to remove --background from arguments
shift

set -euo pipefail  # Exit on error, unset variables, and pipe failures

# Logging to file for persistence
exec >>"$LOG_FILE" 2>&1

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
GIT_BRANCH="main"
COMPOSE_FILE="docker-compose.yml"
LOCK_FILE="/tmp/deploy.lock"
EXPECTED_REPO="FairArena/FairArena"

# Function to log with timestamp
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Atomic deploy lock using flock
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    log "${RED}Deployment already in progress. Exiting.${NC}"
    exit 1
fi

# Cleanup function to release lock (don't remove file)
cleanup() {
    flock -u 200
}
trap cleanup EXIT

log "${BLUE}Starting deployment...${NC}"

# Safety checks for git
current_repo=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | tr '[:upper:]' '[:lower:]')
expected_repo_lower=$(echo "$EXPECTED_REPO" | tr '[:upper:]' '[:lower:]')
if [[ "$current_repo" != "$expected_repo_lower" ]]; then
    log "${RED}Unexpected repository: $current_repo. Expected: $EXPECTED_REPO${NC}"
    exit 1
fi

# Fetch latest code
log "${GREEN}[1/6] Fetching latest code from ${GIT_BRANCH}...${NC}"
git fetch origin || {
    log "${RED}Failed to fetch from origin${NC}"
    exit 1
}

# Explicitly checkout and reset branch
git checkout -B "$GIT_BRANCH" "origin/$GIT_BRANCH" || {
    log "${RED}Failed to checkout branch $GIT_BRANCH${NC}"
    exit 1
}

# Setup environment variables with error checking
log "${GREEN}[2/6] Setting up Backend environment...${NC}"
if [ -f "Backend/envs.sh" ]; then
    cd Backend
    if ! bash envs.sh 2>&1; then
        log "${RED}Failed to setup Backend environment${NC}"
        exit 1
    fi
    cd ..
else
    log "Backend envs.sh not found, skipping"
fi

log "${GREEN}[3/6] Setting up Frontend environment...${NC}"
if [ -f "Frontend/envs.sh" ]; then
    cd Frontend
    if ! bash envs.sh 2>&1; then
        log "${RED}Failed to setup Frontend environment${NC}"
        exit 1
    fi
    cd ..
else
    log "Frontend envs.sh not found, skipping"
fi

# Build and update containers
log "${GREEN}[4/6] Pulling latest images...${NC}"
docker compose -f ${COMPOSE_FILE} pull || {
    log "${RED}Failed to pull images${NC}"
    exit 1
}

log "${GREEN}[5/6] Building and updating containers...${NC}"
docker compose -f ${COMPOSE_FILE} up -d --build

# Note: Removed docker image prune -f to prevent removing images used by other projects or for rollback
# Consider running prune periodically via cron instead

log "${BLUE}Deployment completed successfully!${NC}"
log "${GREEN}[6/6] Checking container status...${NC}"
docker compose -f ${COMPOSE_FILE} ps
