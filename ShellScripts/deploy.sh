#!/bin/bash

LOG_FILE="/var/log/fairarena-deploy.log"
SCRIPT_PATH="$(readlink -f "$0")"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | sed 's/\x1b\[[0-9;]*m//g'
}

# Relaunch in background
if [ "${1:-}" != "--background" ]; then
    nohup bash "$SCRIPT_PATH" --background "$@" &
    echo "Deployment started in background. Check logs at $LOG_FILE. Run 'tail -n 50 $LOG_FILE' to monitor in real-time."
    exit 0
fi
shift

set -euo pipefail

# Logging to file for persistence
exec >>"$LOG_FILE" 2>&1

log "Background deployment process started"

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
log "${GREEN}[1/8] Fetching latest code from ${GIT_BRANCH}...${NC}"
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
log "${GREEN}[2/8] Setting up Backend environment...${NC}"
if [ -f "../Backend/ShellScripts/envs.sh" ]; then
    cd ../Backend/ShellScripts
    if ! bash envs.sh 2>&1; then
        log "${RED}Failed to setup Backend environment${NC}"
        exit 1
    fi
    cd ../../ShellScripts
else
    log "Backend envs.sh not found, skipping"
fi

log "${GREEN}[3/8] Setting up Inngest environment...${NC}"
if [ -f "./envs.inngest.sh" ]; then
    if ! bash envs.inngest.sh 2>&1; then
        log "${RED}Failed to setup Inngest environment${NC}"
        exit 1
    fi
else
    log "envs.inngest.sh not found, skipping"
fi

log "${GREEN}[4/8] Setting up SRH environment...${NC}"
if [ -f "./envs.srh.sh" ]; then
    if ! bash envs.srh.sh 2>&1; then
        log "${RED}Failed to setup SRH environment${NC}"
        exit 1
    fi
else
    log "envs.srh.sh not found, skipping"
fi

log "${GREEN}[5/8] Setting up Credential Validator environment...${NC}"
if [ -f "./envs.credential-validator.sh" ]; then
    if ! bash envs.credential-validator.sh 2>&1; then
        log "${RED}Failed to setup Credential Validator environment${NC}"
        exit 1
    fi
else
    log "envs.credential-validator.sh not found, skipping"
fi

# log "${GREEN}[5/8] Setting up Frontend environment...${NC}"
# if [ -f "Frontend/envs.sh" ]; then
#     cd Frontend
#     if ! bash envs.sh 2>&1; then
#         log "${RED}Failed to setup Frontend environment${NC}"
#         exit 1
#     fi
#     cd ..
# else
#     log "Frontend envs.sh not found, skipping"
# fi

# Build and update containers
log "${GREEN}[6/8] Pulling latest images...${NC}"
cd ..
docker compose -f ${COMPOSE_FILE} pull || {
    log "${RED}Failed to pull images${NC}"
    exit 1
}

log "${GREEN}[7/8] Building and updating containers...${NC}"
docker compose -f ${COMPOSE_FILE} up -d --build

# Note: Removed docker image prune -f to prevent removing images used by other projects or for rollback
# Consider running prune periodically via cron instead

log "${BLUE}Deployment completed successfully!${NC}"
log "${GREEN}[8/8] Checking container status...${NC}"
docker compose -f ${COMPOSE_FILE} ps

# Final confirmation log
log "${GREEN}Deployment finished at $(date). All containers are running.${NC}"
