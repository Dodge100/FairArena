#!/bin/bash

set -e  # Exit on any error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
GIT_BRANCH="main"
COMPOSE_FILE="docker-compose.yml"

echo -e "${BLUE}Starting zero-downtime deployment...${NC}"

# Read token and remove any whitespace/newlines
GITHUB_TOKEN=$(cat .github_token | tr -d '[:space:]')

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GitHub token is empty!${NC}"
    exit 1
fi

# Use git credential helper for authentication
echo -e "${GREEN}[1/3] Configuring authentication...${NC}"
git config --local credential.helper "!f() { echo username=\$GITHUB_TOKEN; echo password=x; }; f"

# Pull latest code
echo -e "${GREEN}[2/3] Pulling latest code from ${GIT_BRANCH}...${NC}"
GIT_ASKPASS_HELPER=$(cat <<EOF
#!/bin/bash
echo "$GITHUB_TOKEN"
EOF
)
echo "$GIT_ASKPASS_HELPER" > /tmp/git-askpass-helper.sh
chmod +x /tmp/git-askpass-helper.sh

GIT_ASKPASS=/tmp/git-askpass-helper.sh git fetch origin
GIT_ASKPASS=/tmp/git-askpass-helper.sh git reset --hard origin/${GIT_BRANCH}

# Setup environment variables
echo -e "${GREEN}[3/5] Setting up Backend environment...${NC}"
cd Backend
bash envs.sh
cd ..

echo -e "${GREEN}[4/5] Setting up Frontend environment...${NC}"
cd Frontend
bash envs.sh
cd ..

# Build and update containers
echo -e "${GREEN}[5/5] Building and updating containers...${NC}"
docker compose -f ${COMPOSE_FILE} up -d --build

# Cleanup
docker image prune -f
rm -f /tmp/git-askpass-helper.sh

echo -e "${BLUE}Deployment completed successfully!${NC}"
docker compose -f ${COMPOSE_FILE} ps
