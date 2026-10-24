#!/usr/bin/env bash
# Stack A CLI demo — run with HomeMCP already listening (default :3000)
set -euo pipefail
BASE="${HOMECP_URL:-http://localhost:3000}"

hr() { printf '\n── %s ──\n' "$1"; }

hr "1. Health"
curl -sS "$BASE/health" | tee /tmp/homemcp-health.json
echo

hr "2. Tools catalog"
curl -sS "$BASE/v1/tools" | head -c 600
echo "…"
echo

hr "3. Dry-run light control (allowed)"
curl -sS "$BASE/v1/tools/call" \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "ha_light_control",
    "entity_id": "light.kitchen",
    "action": "turn_on",
    "brightness_pct": 40,
    "dryRun": true
  }'
echo
echo

hr "4. Denied: unlock front door (policy = none)"
curl -sS "$BASE/v1/tools/call" \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "ha_call_service",
    "domain": "lock",
    "service": "unlock",
    "entity_id": "lock.front_door",
    "dryRun": false
  }'
echo
echo

hr "5. Audit log (last decisions)"
curl -sS "$BASE/v1/audit?limit=5"
echo
echo

hr "Done"
echo "Open $BASE/demo in a browser for the interactive console."
echo "Recording script: DEMO.md"
