# Run Tests Before Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure all backend test suites pass before allowing the docker stack to be pulled down and rebuilt by the `infra/rebuild.sh` script.

**Architecture:** Add a `"test"` script in `backend/package.json` that dynamically executes all JavaScript test suites, and execute this command in `infra/rebuild.sh` prior to stopping the containers. If tests fail, the script terminates immediately.

**Tech Stack:** Node.js, Bash

## Global Constraints

- Run all JavaScript tests (`*.test.js`) in `backend/tests` using Node.js on the host.
- Terminate the rebuild process if any tests fail.

---

### Task 1: Add Test Script to package.json

**Files:**
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: Existing test files in `backend/tests/*.test.js`
- Produces: `npm run test` command in `backend/` that runs all test files and returns exit code 0 on success, or non-zero on failure.

- [ ] **Step 1: Verify missing test script fails**

  Run from the `backend` directory:
  ```bash
  npm run test
  ```
  Expected: Command fails with `npm ERR! missing script: test`.

- [ ] **Step 2: Add the `"test"` script to `backend/package.json`**

  In `backend/package.json`, modify the `"scripts"` object to include the `"test"` command:
  ```json
  "scripts": {
    "start": "node src/server.js",
    "test": "node -e \"const fs = require('fs'), cp = require('child_process'), path = require('path'); fs.readdirSync('tests').filter(f => f.endsWith('.test.js')).forEach(f => cp.execSync('node ' + path.join('tests', f), { stdio: 'inherit' }))\""
  }
  ```

- [ ] **Step 3: Artificially break a test to verify failure**

  In `backend/tests/migration.test.js`, insert a failing assertion on line 18:
  ```javascript
  assert.strictEqual(1, 2, "Intentional failure");
  ```

- [ ] **Step 4: Run the tests to verify the script fails on failure**

  Run from the `backend` directory:
  ```bash
  npm run test
  ```
  Expected: Command fails, prints the stack trace for the failing assertion in `migration.test.js`, and exits with a non-zero code.

- [ ] **Step 5: Restore the broken test**

  Remove the failing assertion added to `backend/tests/migration.test.js`.

- [ ] **Step 6: Run the tests to verify they all pass**

  Run from the `backend` directory:
  ```bash
  npm run test
  ```
  Expected: Command passes with exit code 0, executing all test suites successfully.

- [ ] **Step 7: Commit changes**

  ```bash
  git add backend/package.json
  git commit -m "feat: add dynamic test runner script to backend package.json"
  ```

---

### Task 2: Integrate Test Execution in rebuild.sh

**Files:**
- Modify: `infra/rebuild.sh`

**Interfaces:**
- Consumes: `npm run test` from Task 1.

- [ ] **Step 1: Artificially break a test to verify rebuild abortion**

  In `backend/tests/migration.test.js`, insert a failing assertion on line 18:
  ```javascript
  assert.strictEqual(1, 2, "Intentional failure");
  ```

- [ ] **Step 2: Modify `infra/rebuild.sh` to run tests first**

  Insert the test execution logic right after `log "=== Rebuild Started ==="` on line 102.
  
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

- [ ] **Step 3: Run the rebuild script and verify it aborts**

  Run from the workspace root directory:
  ```bash
  bash infra/rebuild.sh
  ```
  Expected: The output displays the failing test, logs `❌ CRITICAL: Test suites failed! Aborting rebuild.`, exits with code 1, and the docker stack remains untouched.

- [ ] **Step 4: Restore the broken test**

  Remove the failing assertion from `backend/tests/migration.test.js`.

- [ ] **Step 5: Run the rebuild script and verify it succeeds**

  Run from the workspace root directory:
  ```bash
  bash infra/rebuild.sh
  ```
  Expected: The tests run and pass, and the script continues to rebuild the docker stack and finishes successfully.

- [ ] **Step 6: Commit changes**

  ```bash
  git add infra/rebuild.sh
  git commit -m "feat: run backend tests before docker compose down in rebuild.sh"
  ```
