# Run Tests Before Rebuild Spec

Design for executing backend tests in `infra/rebuild.sh` prior to stopping and rebuilding the docker stack.

## Goal

Ensure that all test suites pass before allowing the docker stack to be pulled down and rebuilt by the `infra/rebuild.sh` script.

## Proposed Changes

### Backend Configuration

#### [MODIFY] [package.json](file:///data/projects/mtt-self-host-platform/backend/package.json)
Add a new `"test"` script that programmatically runs all JavaScript tests:
```json
"test": "node -e \"const fs = require('fs'), cp = require('child_process'), path = require('path'); fs.readdirSync('tests').filter(f => f.endsWith('.test.js')).forEach(f => cp.execSync('node ' + path.join('tests', f), { stdio: 'inherit' }))\""
```

### Infrastructure Script

#### [MODIFY] [rebuild.sh](file:///data/projects/mtt-self-host-platform/infra/rebuild.sh)
Insert a test suite verification check at the start of execution before running any docker compose down operations:
```bash
# Run tests
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

log "Running backend tests..."
if ! npm --prefix "$BACKEND_DIR" run test; then
  log "❌ CRITICAL: Test suites failed! Aborting rebuild."
  exit 1
fi
log "✅ All tests passed. Proceeding with rebuild..."
```

## Verification

### Automated Tests
- Trigger `infra/rebuild.sh` and watch it execute tests on host.

### Manual Verification
1. Break one test suite in `backend/tests/` (e.g. change an assertion in `consensus.test.js` to fail).
2. Run `infra/rebuild.sh` and verify it logs `❌ CRITICAL: Test suites failed! Aborting rebuild.` and exits with code 1 without executing docker down.
3. Restore the test suite so all tests pass.
4. Run `infra/rebuild.sh` and verify all tests pass and docker compose down/up proceeds successfully.
