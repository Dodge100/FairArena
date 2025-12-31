#!/bin/bash

LOG_FILE="/var/log/fairarena-deploy.log"
SCRIPT_PATH="$(readlink -f "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
TEMP_LOG_FILE="/tmp/fairarena-deploy-$(date +%Y%m%d%H%M%S).log"

# Git Configuration
GIT_BRANCH="main"
COMPOSE_FILE="docker-compose.yml"
LOCK_FILE="/tmp/deploy.lock"
EXPECTED_REPO="FairArena/FairArena"

# Email Configuration (Load from environment or .env file)
EMAIL_ENV_FILE="${SCRIPT_DIR}/.env.deploy-email"
if [ -f "$EMAIL_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$EMAIL_ENV_FILE"
fi

# Gmail SMTP settings
SMTP_SERVER="${SMTP_SERVER:-smtp.gmail.com}"
SMTP_PORT="${SMTP_PORT:-587}"
GMAIL_USER="${GMAIL_USER:-}"
GMAIL_APP_PASSWORD="${GMAIL_APP_PASSWORD:-}"
EMAIL_FROM="${EMAIL_FROM:-$GMAIL_USER}"
EMAIL_TO="${EMAIL_TO:-}"
EMAIL_SUBJECT_PREFIX="${EMAIL_SUBJECT_PREFIX:-[FairArena Deploy]}"

# Azure Blob Storage settings for log upload
AZURE_STORAGE_CONTAINER="${AZURE_STORAGE_CONTAINER:-fairarena-vm-deploy-logs}"
AZURE_STORAGE_CONNECTION_STRING="${AZURE_STORAGE_CONNECTION_STRING:-}"
AZURE_STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-}"
AZURE_STORAGE_SAS_TOKEN="${AZURE_STORAGE_SAS_TOKEN:-}"

# Deployment metadata
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
DEPLOY_ID="$(date +%Y%m%d%H%M%S)-$$"
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
START_EPOCH=$(date +%s)

# Color codes - use $'...' syntax for proper escape sequence interpretation
# These are only used for visual output, stripped from logs
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m' # No Color

# Log function - writes to stdout (which is redirected to LOG_FILE by exec)
log() {
    local message="$(date '+%Y-%m-%d %H:%M:%S') - $*"
    # Strip both actual ANSI escape sequences and literal \033 strings
    echo "$message" | sed -e 's/\x1b\[[0-9;]*m//g' -e 's/\\033\[[0-9;]*m//g'
}

log_section() {
    log "========================================================================"
    log "$1"
    log "========================================================================"
}

# Create a snapshot of logs for email/azure upload (called at end)
create_log_snapshot() {
    # Ensure temp log file can be created
    touch "$TEMP_LOG_FILE" 2>/dev/null || true

    if [ -f "$LOG_FILE" ]; then
        # Extract only this deployment's logs using the deploy ID marker
        local start_marker="STARTING DEPLOYMENT - ID: $DEPLOY_ID"
        # Copy from start marker to end of file
        sed -n "/$start_marker/,\$p" "$LOG_FILE" > "$TEMP_LOG_FILE" 2>/dev/null || \
            tail -n 1000 "$LOG_FILE" > "$TEMP_LOG_FILE" 2>/dev/null || \
            echo "No logs available" > "$TEMP_LOG_FILE"
    else
        echo "Log file not found: $LOG_FILE" > "$TEMP_LOG_FILE"
    fi
}

# Upload logs to Azure Blob Storage
upload_logs_to_azure() {
    local status="$1"  # SUCCESS or FAILURE

    # Check if Azure CLI is available
    if ! command -v az &> /dev/null; then
        log "${YELLOW}Warning: Azure CLI not installed - skipping blob upload${NC}"
        return 0
    fi

    # Check if we have credentials
    if [ -z "$AZURE_STORAGE_CONNECTION_STRING" ] && [ -z "$AZURE_STORAGE_SAS_TOKEN" ]; then
        log "${YELLOW}Warning: No Azure storage credentials configured - skipping blob upload${NC}"
        return 0
    fi

    if [ ! -f "$TEMP_LOG_FILE" ]; then
        log "${YELLOW}Warning: Temp log file not found - skipping blob upload${NC}"
        return 0
    fi

    # Generate blob name with timestamp and status
    local blob_name="deploy-${DEPLOY_ID}-${status}.log"

    log "Uploading logs to Azure Blob Storage: ${AZURE_STORAGE_CONTAINER}/${blob_name}"

    local upload_result
    local upload_exit_code

    # Try connection string first, then SAS token
    if [ -n "$AZURE_STORAGE_CONNECTION_STRING" ]; then
        upload_result=$(az storage blob upload \
            --container-name "$AZURE_STORAGE_CONTAINER" \
            --file "$TEMP_LOG_FILE" \
            --name "$blob_name" \
            --connection-string "$AZURE_STORAGE_CONNECTION_STRING" \
            --overwrite true \
            2>&1) || upload_exit_code=$?
    elif [ -n "$AZURE_STORAGE_SAS_TOKEN" ] && [ -n "$AZURE_STORAGE_ACCOUNT" ]; then
        upload_result=$(az storage blob upload \
            --container-name "$AZURE_STORAGE_CONTAINER" \
            --file "$TEMP_LOG_FILE" \
            --name "$blob_name" \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --sas-token "$AZURE_STORAGE_SAS_TOKEN" \
            --overwrite true \
            2>&1) || upload_exit_code=$?
    fi

    if [ "${upload_exit_code:-0}" -eq 0 ]; then
        log "${GREEN}Logs uploaded to Azure Blob Storage successfully${NC}"
        return 0
    else
        log "${YELLOW}Warning: Failed to upload logs to Azure: $upload_result${NC}"
        return 0  # Non-blocking - don't fail deployment
    fi
}

validate_email_config() {
    local missing_vars=()

    if [ -z "$GMAIL_USER" ]; then
        missing_vars+=("GMAIL_USER")
    fi
    if [ -z "$GMAIL_APP_PASSWORD" ]; then
        missing_vars+=("GMAIL_APP_PASSWORD")
    fi
    if [ -z "$EMAIL_TO" ]; then
        missing_vars+=("EMAIL_TO")
    fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log "${YELLOW}Warning: Email notification disabled. Missing: ${missing_vars[*]}${NC}"
        log "${YELLOW}Create ${EMAIL_ENV_FILE} with required variables to enable notifications.${NC}"
        return 1
    fi
    return 0
}

send_email() {
    local subject="$1"
    local body="$2"
    local status="$3"  # SUCCESS or FAILURE

    if ! validate_email_config; then
        log "${YELLOW}Skipping email notification - configuration incomplete${NC}"
        return 0  # Return success - email failure should not affect deployment
    fi

    local full_subject="${EMAIL_SUBJECT_PREFIX} ${status}: ${subject}"

    # Calculate duration
    local end_epoch=$(date +%s)
    local duration=$((end_epoch - START_EPOCH))
    local duration_formatted="$(printf '%02d:%02d:%02d' $((duration/3600)) $(((duration%3600)/60)) $((duration%60)))"

    # Generate unique boundary for MIME
    local boundary="----=_Part_${DEPLOY_ID}_$(date +%s)"
    local log_filename="fairarena-deploy-${DEPLOY_ID}.log"

    # Base64 encode log file for attachment
    local log_base64=""
    if [ -f "$TEMP_LOG_FILE" ]; then
        log_base64=$(base64 "$TEMP_LOG_FILE" 2>/dev/null || base64 -w 0 "$TEMP_LOG_FILE" 2>/dev/null || cat "$TEMP_LOG_FILE" | base64 2>/dev/null || echo "")
    fi

    # Get log file size for display
    local log_size="0 KB"
    if [ -f "$TEMP_LOG_FILE" ]; then
        local size_bytes=$(stat -f%z "$TEMP_LOG_FILE" 2>/dev/null || stat -c%s "$TEMP_LOG_FILE" 2>/dev/null || echo "0")
        log_size="$(echo "scale=1; $size_bytes / 1024" | bc 2>/dev/null || echo "$((size_bytes / 1024))") KB"
    fi

    # Build HTML email body (without inline logs - they're attached as file)
    local html_body="<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { padding: 20px 30px; color: white; }
        .header.success { background: linear-gradient(135deg, #10b981, #059669); }
        .header.failure { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 20px; }
        .info-label { font-weight: 600; color: #6b7280; }
        .info-value { color: #1f2937; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .status-badge.success { background: #d1fae5; color: #065f46; }
        .status-badge.failure { background: #fee2e2; color: #991b1b; }
        .attachment-notice { margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #6366f1; }
        .attachment-notice h3 { margin: 0 0 10px 0; color: #374151; }
        .attachment-notice p { margin: 0; color: #6b7280; }
        .footer { padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header $([ "$status" = "SUCCESS" ] && echo "success" || echo "failure")'>
            <h1>$([ "$status" = "SUCCESS" ] && echo "✅" || echo "❌") FairArena Deployment $([ "$status" = "SUCCESS" ] && echo "Succeeded" || echo "Failed")</h1>
        </div>
        <div class='content'>
            <div class='info-grid'>
                <span class='info-label'>Status:</span>
                <span class='info-value'><span class='status-badge $([ "$status" = "SUCCESS" ] && echo "success" || echo "failure")'>$status</span></span>

                <span class='info-label'>Deploy ID:</span>
                <span class='info-value'>$DEPLOY_ID</span>

                <span class='info-label'>Host:</span>
                <span class='info-value'>$HOSTNAME</span>

                <span class='info-label'>Branch:</span>
                <span class='info-value'>$GIT_BRANCH</span>

                <span class='info-label'>Started:</span>
                <span class='info-value'>$START_TIME</span>

                <span class='info-label'>Finished:</span>
                <span class='info-value'>$(date '+%Y-%m-%d %H:%M:%S')</span>

                <span class='info-label'>Duration:</span>
                <span class='info-value'>$duration_formatted</span>

                <span class='info-label'>Error:</span>
                <span class='info-value'>$([ "$status" = "FAILURE" ] && echo "$DEPLOY_MESSAGE" || echo "None")</span>
            </div>

            <div class='attachment-notice'>
                <h3>� Log File Attached</h3>
                <p>Complete deployment logs are attached as <strong>$log_filename</strong> ($log_size)</p>
                <p>Open the attachment to view the full build output.</p>
            </div>
        </div>
        <div class='footer'>
            <p>This is an automated notification from FairArena Deployment System</p>
            <p>Server log location: $LOG_FILE</p>
        </div>
    </div>
</body>
</html>"

    # Create MIME email with attachment
    local email_content="From: FairArena Deploy <${EMAIL_FROM}>
To: ${EMAIL_TO}
Subject: ${full_subject}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary=\"${boundary}\"

--${boundary}
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

${html_body}

--${boundary}
Content-Type: text/plain; charset=UTF-8; name=\"${log_filename}\"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename=\"${log_filename}\"

${log_base64}

--${boundary}--"

    # Send email using curl with Gmail SMTP
    log "Sending email notification to $EMAIL_TO..."

    local email_result
    email_result=$(echo "$email_content" | curl --silent --show-error \
        --url "smtps://${SMTP_SERVER}:465" \
        --ssl-reqd \
        --mail-from "$EMAIL_FROM" \
        --mail-rcpt "$EMAIL_TO" \
        --user "${GMAIL_USER}:${GMAIL_APP_PASSWORD}" \
        -T - 2>&1)

    local curl_exit_code=$?

    if [ $curl_exit_code -eq 0 ]; then
        log "${GREEN}Email notification sent successfully (log attached as $log_filename)${NC}"
        return 0
    else
        log "${YELLOW}Warning: Failed to send email notification: $email_result${NC}"

        # Try alternative method with msmtp if available
        if command -v msmtp &> /dev/null && [ -f ~/.msmtprc ]; then
            log "Attempting to send via msmtp..."
            if echo "$email_content" | msmtp "$EMAIL_TO" 2>/dev/null; then
                log "${GREEN}Email sent via msmtp${NC}"
                return 0
            fi
        fi

        # Try with sendmail if available
        if command -v sendmail &> /dev/null; then
            log "Attempting to send via sendmail..."
            if echo "$email_content" | sendmail -t 2>/dev/null; then
                log "${GREEN}Email sent via sendmail${NC}"
                return 0
            fi
        fi

        log "${YELLOW}Warning: All email sending methods failed - deployment will continue${NC}"
        return 0  # Return success - email failure should not affect deployment
    fi
}

DEPLOY_STATUS="FAILURE"
DEPLOY_MESSAGE="Deployment failed unexpectedly"
LOCK_ACQUIRED="false"  # Track if we actually hold the lock
PID_FILE="/tmp/deploy.pid"  # Define here for cleanup access

cleanup() {
    local exit_code=$?

    # Only release the lock if we actually acquired it
    if [ "$LOCK_ACQUIRED" = "true" ] && [ -n "${LOCK_FD:-}" ]; then
        flock -u "$LOCK_FD" 2>/dev/null || true
        # Clear the PID file to indicate we're done
        rm -f "$PID_FILE" 2>/dev/null || true
        log "Lock released"
    fi

    # Log final status
    if [ "$DEPLOY_STATUS" = "SUCCESS" ]; then
        log_section "DEPLOYMENT COMPLETED SUCCESSFULLY"
    else
        log_section "DEPLOYMENT FAILED"
        log "Exit code: $exit_code"
        log "Error: $DEPLOY_MESSAGE"
    fi

    # Create snapshot of this deployment's logs for email/azure upload
    create_log_snapshot

    # Send email notification (uses TEMP_LOG_FILE snapshot as attachment)
    if [ "$DEPLOY_STATUS" = "SUCCESS" ]; then
        send_email "$DEPLOY_MESSAGE" "" "SUCCESS"
    else
        send_email "$DEPLOY_MESSAGE" "" "FAILURE"
    fi

    # Upload logs to Azure Blob Storage
    if [ "$DEPLOY_STATUS" = "SUCCESS" ]; then
        upload_logs_to_azure "SUCCESS"
    else
        upload_logs_to_azure "FAILURE"
    fi

    # Cleanup temp files (but keep for debugging if failed)
    if [ "$DEPLOY_STATUS" = "SUCCESS" ]; then
        rm -f "$TEMP_LOG_FILE" 2>/dev/null || true
    else
        log "Temp log preserved at: $TEMP_LOG_FILE"
    fi
}

# Set up trap to catch ALL exit scenarios
trap cleanup EXIT

# Error handler - called on any command failure when set -e is active
error_handler() {
    local line_no=$1
    local error_code=$2
    DEPLOY_MESSAGE="Script failed at line $line_no with exit code $error_code"
    log "${RED}ERROR: $DEPLOY_MESSAGE${NC}"
}

trap 'error_handler ${LINENO} $?' ERR

# Background Execution Handler
if [ "${1:-}" != "--background" ]; then
    # Launch in background and fully detach from terminal
    nohup bash "$SCRIPT_PATH" --background "$@" > /dev/null 2>&1 &

    # Store the PID for reference
    BACKGROUND_PID=$!

    echo "Deployment started in background (PID: $BACKGROUND_PID)"
    echo "Check logs at: $LOG_FILE"
    echo "Monitor with: tail -f $LOG_FILE"
    echo "Deploy ID: $DEPLOY_ID"

    # Disown to fully detach from this shell
    disown $BACKGROUND_PID 2>/dev/null || true

    # Don't trigger cleanup trap for the foreground process
    trap - EXIT
    exit 0
fi
shift

# Create all required files BEFORE enabling strict mode
# This ensures they exist and avoids errors with set -e
mkdir -p /tmp 2>/dev/null || true
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
touch "$LOG_FILE" "$LOCK_FILE" "$TEMP_LOG_FILE" 2>/dev/null || true

# Enable strict mode AFTER file creation
set -euo pipefail

# Redirect stdout/stderr to log file for real-time monitoring
exec >> "$LOG_FILE" 2>&1

# Main Deployment Logic
log_section "STARTING DEPLOYMENT - ID: $DEPLOY_ID"
log "Host: $HOSTNAME"
log "Branch: $GIT_BRANCH"
log "Compose File: $COMPOSE_FILE"
log "Start Time: $START_TIME"

# Acquire deployment lock with stale lock detection
log "${BLUE}[INIT] Acquiring deployment lock...${NC}"

# PID_FILE is defined earlier for cleanup access

# Check for stale lock - if PID file exists, check if the PID is still running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$OLD_PID" ] && [ "$OLD_PID" != "$$" ]; then
        if ! kill -0 "$OLD_PID" 2>/dev/null; then
            log "${YELLOW}Stale lock detected (PID $OLD_PID is dead). Clearing...${NC}"
            rm -f "$LOCK_FILE" "$PID_FILE"
        else
            log "${YELLOW}Deployment already running (PID $OLD_PID is alive)${NC}"
        fi
    fi
fi

# Use flock for atomic locking (files already created before strict mode)
LOCK_FD=200
exec 200>>"$LOCK_FILE"
if ! flock -n 200; then
    DEPLOY_MESSAGE="Deployment already in progress"
    log "${RED}$DEPLOY_MESSAGE. Exiting.${NC}"
    # Don't set LOCK_ACQUIRED - we don't hold the lock
    exit 1
fi

# Mark that we successfully acquired the lock
LOCK_ACQUIRED="true"

# Write our PID to the separate PID file for stale detection
echo "$$" > "$PID_FILE"
log "${GREEN}Lock acquired (PID: $$)${NC}"

# Safety checks for git
log "${BLUE}[INIT] Validating repository...${NC}"
current_repo=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | tr '[:upper:]' '[:lower:]')
expected_repo_lower=$(echo "$EXPECTED_REPO" | tr '[:upper:]' '[:lower:]')
if [[ "$current_repo" != "$expected_repo_lower" ]]; then
    DEPLOY_MESSAGE="Unexpected repository: $current_repo (expected: $EXPECTED_REPO)"
    log "${RED}$DEPLOY_MESSAGE${NC}"
    exit 1
fi
log "${GREEN}Repository validated: $current_repo${NC}"

# Get current commit before update
PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log "Previous commit: $PREV_COMMIT"

# Step 1: Fetch latest code
log "${GREEN}[1/10] Fetching latest code from ${GIT_BRANCH}...${NC}"
if ! git fetch origin 2>&1; then
    DEPLOY_MESSAGE="Failed to fetch from origin"
    log "${RED}$DEPLOY_MESSAGE${NC}"
    exit 1
fi
log "Fetch completed successfully"

# Step 2: Checkout and reset branch
log "${GREEN}[2/10] Checking out branch ${GIT_BRANCH}...${NC}"
if ! git checkout -B "$GIT_BRANCH" "origin/$GIT_BRANCH" 2>&1; then
    DEPLOY_MESSAGE="Failed to checkout branch $GIT_BRANCH"
    log "${RED}$DEPLOY_MESSAGE${NC}"
    exit 1
fi

# Get new commit after update
NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log "New commit: $NEW_COMMIT"

if [ "$PREV_COMMIT" != "$NEW_COMMIT" ]; then
    log "${YELLOW}Code updated from $PREV_COMMIT to $NEW_COMMIT${NC}"
    # Get commit message
    COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
    log "Latest commit: $COMMIT_MSG"
else
    log "No new commits - rebuilding with current code"
fi

# Step 3: Setup Backend environment
log "${GREEN}[3/10] Setting up Backend environment...${NC}"
if [ -f "../Backend/ShellScripts/envs.sh" ]; then
    cd ../Backend/ShellScripts
    if ! bash envs.sh 2>&1; then
        DEPLOY_MESSAGE="Failed to setup Backend environment"
        log "${RED}$DEPLOY_MESSAGE${NC}"
        exit 1
    fi
    # cd ../../
    cd ../../ShellScripts
    log "Backend environment configured"
else
    log "${YELLOW}Backend envs.sh not found, skipping${NC}"
fi

# Step 4: Setup Frontend environment
# log "${GREEN}[4/10] Setting up Frontend environment...${NC}"
# if [ -f "./Frontend/ShellScripts/envs.sh" ]; then
#     cd ./Frontend/
#     if ! bash envs.sh 2>&1; then
#         DEPLOY_MESSAGE="Failed to setup Frontend environment"
#         log "${RED}$DEPLOY_MESSAGE${NC}"
#         exit 1
#     fi
#     cd ../ShellScripts
#     log "Frontend environment configured"
# else
#     log "${YELLOW}Frontend envs.sh not found, skipping${NC}"
# fi

# Step 4: Setup Inngest environment
log "${GREEN}[4/10] Setting up Inngest environment...${NC}"
if [ -f "./envs.inngest.sh" ]; then
    if ! bash envs.inngest.sh 2>&1; then
        DEPLOY_MESSAGE="Failed to setup Inngest environment"
        log "${RED}$DEPLOY_MESSAGE${NC}"
        exit 1
    fi
    log "Inngest environment configured"
else
    log "${YELLOW}envs.inngest.sh not found, skipping${NC}"
fi

# Step 5: Setup SRH environment
log "${GREEN}[5/10] Setting up SRH environment...${NC}"
if [ -f "./envs.srh.sh" ]; then
    if ! bash envs.srh.sh 2>&1; then
        DEPLOY_MESSAGE="Failed to setup SRH environment"
        log "${RED}$DEPLOY_MESSAGE${NC}"
        exit 1
    fi
    log "SRH environment configured"
else
    log "${YELLOW}envs.srh.sh not found, skipping${NC}"
fi

# Step 6: Setup Credential Validator environment
log "${GREEN}[6/10] Setting up Credential Validator environment...${NC}"
if [ -f "./envs.credential-validator.sh" ]; then
    if ! bash envs.credential-validator.sh 2>&1; then
        DEPLOY_MESSAGE="Failed to setup Credential Validator environment"
        log "${RED}$DEPLOY_MESSAGE${NC}"
        exit 1
    fi
    log "Credential Validator environment configured"
else
    log "${YELLOW}envs.credential-validator.sh not found, skipping${NC}"
fi

# Step 7: Setup N8N environment
# log "${GREEN}[7/10] Setting up N8N environment...${NC}"
# if [ -f "./envs.n8n.sh" ]; then
#     if ! bash envs.n8n.sh 2>&1; then
#         DEPLOY_MESSAGE="Failed to setup N8N environment"
#         log "${RED}$DEPLOY_MESSAGE${NC}"
#         exit 1
#     fi
#     log "N8N environment configured"
# else
#     log "${YELLOW}envs.n8n.sh not found, skipping${NC}"
# fi

# Step 8: Setup OTel environments
log "${GREEN}[8/10] Setting up Observability environment...${NC}"
if [ -f "./envs.otel.sh" ]; then
    if ! bash envs.otel.sh 2>&1; then
        DEPLOY_MESSAGE="Failed to setup OTel environment"
        log "${RED}$DEPLOY_MESSAGE${NC}"
        exit 1
    fi
    log "OTel environment configured"
else
    log "${YELLOW}envs.otel.sh not found, skipping${NC}"
fi

if [ -f "./envs.github.sh" ]; then
    if ! bash envs.github.sh 2>&1; then
        DEPLOY_MESSAGE="Failed to setup GitHub OTel environment"
        log "${RED}$DEPLOY_MESSAGE${NC}"
        exit 1
    fi
    log "GitHub OTel environment configured"
else
    log "${YELLOW}envs.github.sh not found, skipping${NC}"
fi

# Step 9: Pull and build Docker images
log "${GREEN}[9/10] Pulling latest images and building containers...${NC}"
cd ..

# log "Pulling Docker images..."
# if ! docker compose -f ${COMPOSE_FILE} pull 2>&1; then
#     DEPLOY_MESSAGE="Failed to pull Docker images"
#     log "${RED}$DEPLOY_MESSAGE${NC}"
#     exit 1
# fi
# log "Docker pull completed"

log "Building and starting containers..."
if ! docker compose -f ${COMPOSE_FILE} up -d --build 2>&1; then
    DEPLOY_MESSAGE="Failed to build and start containers"
    log "${RED}$DEPLOY_MESSAGE${NC}"
    exit 1
fi
log "Containers built and started"

# Step 10: Verify deployment
log "${GREEN}[10/10] Verifying deployment...${NC}"
sleep 5  # Give containers time to stabilize

# Check container status
log "Container Status:"
docker compose -f ${COMPOSE_FILE} ps 2>&1

# Count running vs expected containers
RUNNING_CONTAINERS=$(docker compose -f ${COMPOSE_FILE} ps --status running -q 2>/dev/null | wc -l)
TOTAL_CONTAINERS=$(docker compose -f ${COMPOSE_FILE} ps -q 2>/dev/null | wc -l)

if [ "$RUNNING_CONTAINERS" -eq 0 ]; then
    DEPLOY_MESSAGE="No containers are running after deployment"
    log "${RED}$DEPLOY_MESSAGE${NC}"
    exit 1
fi

if [ "$RUNNING_CONTAINERS" -lt "$TOTAL_CONTAINERS" ]; then
    log "${YELLOW}Warning: Only $RUNNING_CONTAINERS of $TOTAL_CONTAINERS containers are running${NC}"
    # Get unhealthy containers
    UNHEALTHY=$(docker compose -f ${COMPOSE_FILE} ps --status exited --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || true)
    if [ -n "$UNHEALTHY" ]; then
        log "Stopped/Unhealthy containers:"
        log "$UNHEALTHY"
    fi
fi

# Check for any restart loops (containers that restarted recently)
log "Checking for container health..."
RESTART_ISSUES=$(docker compose -f ${COMPOSE_FILE} ps --format json 2>/dev/null | grep -c '"Health":"unhealthy"' || echo "0")
if [ "$RESTART_ISSUES" -gt 0 ]; then
    log "${YELLOW}Warning: $RESTART_ISSUES containers have health issues${NC}"
fi

# Success!
DEPLOY_STATUS="SUCCESS"
DEPLOY_MESSAGE="Deployed successfully - $RUNNING_CONTAINERS containers running"

log_section "DEPLOYMENT SUMMARY"
log "Deploy ID: $DEPLOY_ID"
log "Previous Commit: $PREV_COMMIT"
log "Current Commit: $NEW_COMMIT"
log "Running Containers: $RUNNING_CONTAINERS"
log "Total Containers: $TOTAL_CONTAINERS"
log "Status: SUCCESS"

END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
END_EPOCH=$(date +%s)
DURATION=$((END_EPOCH - START_EPOCH))
log "Deployment completed at $END_TIME (Duration: ${DURATION}s)"

# Exit cleanly - cleanup trap will send success email
exit 0
