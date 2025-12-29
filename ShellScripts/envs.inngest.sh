#!/bin/bash

set -e

PROJECT="fair-arena"           # Doppler project slug
CONFIG="production-inngest"                 # doppler config: dev/stg/prod etc.
ENV_FILE=".env.inngest"               # target env file
DOPPLER_TOKEN_FILE=".doppler_inngest_token"

# Load Doppler token from file
if [ ! -f "$DOPPLER_TOKEN_FILE" ]; then
  echo "Error: Doppler token file '$DOPPLER_TOKEN_FILE' not found"
  echo "Create it and put your Doppler service token inside:"
  echo "  echo \"dp.st.your_token_here\" > $DOPPLER_TOKEN_FILE"
  exit 1
fi

DOPPLER_TOKEN=$(cat "$DOPPLER_TOKEN_FILE" | tr -d '[:space:]')

if [ -z "$DOPPLER_TOKEN" ]; then
  echo "Error: Doppler token in $DOPPLER_TOKEN_FILE is empty"
  exit 1
fi

echo "Fetching Doppler secrets for project=$PROJECT config=$CONFIG -> $ENV_FILE"

doppler secrets download \
  --project "$PROJECT" \
  --config "$CONFIG" \
  --token "$DOPPLER_TOKEN" \
  --format env \
  --no-file > "$ENV_FILE"

echo "Secrets written to $ENV_FILE"
