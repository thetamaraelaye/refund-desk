#!/usr/bin/env bash
# Builds and starts the whole stack, then runs every test layer against it:
#   1. API unit tests (policy engine, model layer, reply guard)
#   2. Web typecheck and lint
#   3. docker compose up --build, waiting until every service is healthy
#   4. API end-to-end checks over HTTP
#   5. Browser tests in Chromium with Playwright (desktop and phone), including axe accessibility checks
#
# Needs Docker and Node 22+. Set PW_CHANNEL=chrome to use an installed Chrome instead of downloading
# Playwright's Chromium. The demo data is reset before steps 4 and 5; the catalogue is kept.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="http://localhost:${API_PORT:-4000}"
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1/5 API unit tests"
(cd apps/api && npm ci --no-audit --no-fund --loglevel=error && npm test --silent)

step "2/5 Web typecheck and lint"
(cd apps/web && npm ci --no-audit --no-fund --loglevel=error && npm run typecheck && npm run lint)

step "3/5 Starting the stack"
docker compose up --build --detach --wait

step "4/5 API end-to-end"
docker compose exec -T api node dist/database/seed.js --reset
API_URL="$API_URL" node apps/api/scripts/e2e.mjs

step "5/5 Browser tests (Playwright)"
cd e2e
npm ci --no-audit --no-fund --loglevel=error
if [ -z "${PW_CHANNEL:-}" ]; then npx playwright install chromium; fi
npx playwright test

step "All test layers passed. The stack is still running at http://localhost:${WEB_PORT:-3000}"
