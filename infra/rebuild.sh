#!/bin/bash
# Stop containers, optionally wipe database, remove backend/frontend images, restart, and verify health

WIPE=0
if [[ "$1" == "--wipe" ]]; then
  WIPE=1
fi

LOG_FILE="/data/projects/mtt-self-host-platform/infra/rebuild.log"
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

free_port_5000() {
  log "Attempting to force-release port 5000..."
  
  # Try fuser
  if command -v fuser >/dev/null 2>&1; then
    log "Using fuser to kill processes on port 5000..."
    sudo fuser -k -9 5000/tcp >/dev/null 2>&1 || fuser -k -9 5000/tcp >/dev/null 2>&1 || true
  fi

  # Try lsof fallback
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti tcp:5000 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      log "Using lsof to kill processes on port 5000 (PIDs: $pids)..."
      echo "$pids" | xargs -r kill -9 >/dev/null 2>&1 || sudo echo "$pids" | xargs -r kill -9 >/dev/null 2>&1 || true
    fi
  fi

  # Wait for port release
  sleep 3
}

check_health() {
  log "Verifying container health..."
  local max_attempts=12
  local attempt=1
  local all_healthy=0

  while [ $attempt -le $max_attempts ]; do
    log "Health check attempt $attempt/$max_attempts..."
    local check_failed=0

    # 1. Check container states
    for container in marine-backend marine-frontend marine_graphdb marine_ldes_consumer; do
      local state
      state=$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || echo "false")
      if [ "$state" != "true" ]; then
        log "⚠️ Container $container is not running."
        check_failed=1
      fi
    done

    # 2. Check backend HTTP endpoint (port 5000)
    if [ $check_failed -eq 0 ]; then
      local headers
      headers=$(curl -s -I http://localhost:5000/sparql/health || echo "failed")
      if [[ "$headers" == "failed" ]]; then
        log "⚠️ Backend HTTP check failed (could not connect)."
        check_failed=1
      elif echo "$headers" | grep -iq "Werkzeug"; then
        log "⚠️ Port 5000 is occupied by Werkzeug (Nutanix/Python), not our backend container!"
        check_failed=1
      elif ! echo "$headers" | grep -iqE "HTTP/1\.[01] [2345][0-9][0-9]"; then
        log "⚠️ Backend HTTP check returned invalid response status."
        check_failed=1
      fi
    fi

    # 3. Check frontend HTTP endpoint (port 4173)
    if [ $check_failed -eq 0 ]; then
      local frontend_status
      frontend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/ || echo "failed")
      if [[ "$frontend_status" == "failed" || "$frontend_status" == "000" ]]; then
        log "⚠️ Frontend HTTP check failed on port 4173."
        check_failed=1
      fi
    fi

    if [ $check_failed -eq 0 ]; then
      log "✓ All containers and endpoints responded successfully!"
      all_healthy=1
      break
    fi

    sleep 5
    attempt=$((attempt + 1))
  done

  if [ $all_healthy -eq 1 ]; then
    return 0
  else
    return 1
  fi
}

# --- Execution Start ---

log "=== Rebuild Started ==="

# 1. Stop Stack & Clean
log "Stopping current Docker Compose stack..."
docker compose down

if [[ $WIPE -eq 1 ]]; then
  log "⚠️ WARNING: Wiping database and backend data"
  sudo rm -rf backend/data/translations.db
  sudo rm -rf data
fi

# 2. Force free port 5000 before starting
free_port_5000

# 3. Remove old images
log "Removing old build images..."
docker rmi mtt-self-host-platform-backend mtt-self-host-platform-frontend || true

# 4. Start Stack
log "Starting stack and building images..."
if ! docker compose up -d --build; then
  log "❌ Initial build/start failed. Retrying self-healing..."
  free_port_5000
  docker compose up -d --build
fi

# 5. Run Health Checks
check_health
if [ $? -eq 0 ]; then
  log "✅ Stack is completely healthy and responding!"
  log "=== Rebuild Completed Successfully ==="
  exit 0
else
  log "⚠️ Health checks failed after initial start. Initiating self-healing..."
  docker compose down
  free_port_5000
  log "Rebuilding and starting stack after self-healing..."
  docker compose up -d --build
  
  check_health
  if [ $? -eq 0 ]; then
    log "✅ Stack is healthy after self-healing!"
    log "=== Rebuild Completed Successfully ==="
    exit 0
  else
    log "❌ CRITICAL: Health checks failed after self-healing. Rebuild failed."
    log "=== Rebuild Failed ==="
    exit 1
  fi
fi
