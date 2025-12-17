#!/bin/bash

set -e

# Configuration (update these)
DOPPLER_PROJECT="fair-arena"           # Doppler project slug
DOPPLER_CONFIG="prd"                 # Doppler config: dev/stg/prd etc.
AZURE_KEY_VAULT_NAME="FairArena"     # Replace with your Azure Key Vault name
DOPPLER_TOKEN_FILE=".doppler_token"   # File containing Doppler service token

# Function to log messages
log() {
  echo "$(date +'%Y-%m-%d %H:%M:%S') - $1"
}

log "Starting Doppler to Azure Key Vault sync..."

# Load Doppler token from file (like in envs.sh)
if [ ! -f "$DOPPLER_TOKEN_FILE" ]; then
  log "Error: Doppler token file '$DOPPLER_TOKEN_FILE' not found"
  log "Create it and put your Doppler service token inside:"
  log "  echo \"dp.st.your_token_here\" > $DOPPLER_TOKEN_FILE"
  exit 1
fi

DOPPLER_TOKEN=$(cat "$DOPPLER_TOKEN_FILE" | tr -d '[:space:]')

if [ -z "$DOPPLER_TOKEN" ]; then
  log "Error: Doppler token in $DOPPLER_TOKEN_FILE is empty"
  exit 1
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  log "Error: Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi

# Fetch secrets from Doppler as env format (like envs.sh)
log "Fetching secrets from Doppler..."
TEMP_ENV_FILE=$(mktemp)
doppler secrets download \
  --project "$DOPPLER_PROJECT" \
  --config "$DOPPLER_CONFIG" \
  --token "$DOPPLER_TOKEN" \
  --format env \
  --no-file > "$TEMP_ENV_FILE"

if [ $? -ne 0 ]; then
  log "Error: Failed to fetch secrets from Doppler."
  rm -f "$TEMP_ENV_FILE"
  exit 1
fi

# Parse the env file and set secrets in Azure Key Vault
while IFS='=' read -r KEY VALUE; do
  # Skip empty lines or comments
  [[ -z "$KEY" || "$KEY" =~ ^# ]] && continue

  # Remove quotes if present
  VALUE=$(echo "$VALUE" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")

  # Skip empty values
  if [ -z "$VALUE" ]; then
    log "Skipping empty secret: $KEY"
    continue
  fi

  # Replace underscores with hyphens for Azure Key Vault naming
  AZURE_KEY=$(echo "$KEY" | tr '_' '-')

  log "Setting secret in Azure Key Vault: $AZURE_KEY (from Doppler key: $KEY)"

  # Set the secret (this will create or update if it exists)
  az keyvault secret set --vault-name "$AZURE_KEY_VAULT_NAME" --name "$AZURE_KEY" --value "$VALUE"

  if [ $? -eq 0 ]; then
    log "Successfully set/updated secret: $AZURE_KEY"
  else
    log "Error: Failed to set secret: $AZURE_KEY"
  fi
done < "$TEMP_ENV_FILE"

# Clean up
rm -f "$TEMP_ENV_FILE"

log "Doppler to Azure Key Vault sync completed."
