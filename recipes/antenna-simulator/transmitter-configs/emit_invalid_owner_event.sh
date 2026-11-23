#!/usr/bin/env bash
# ==============================================================================
# Script: emit_invalid_owner_event.sh
# Description: Pushes a sample "Agent Invalid Owner" event (AuthMind-style
#              raw event) to the Antenna Transmitter. The vip_event_mapper.js
#              transforms it into a SET carrying:
#                urn:ibm:agent:invalid_owner
#
# Usage:
#   ./emit_invalid_owner_event.sh [TRANSMITTER_URL] [AGENT_ID] [PREV_OWNER_ID] [SPIFFE_ID]
#
# Examples:
#   ./emit_invalid_owner_event.sh
#   ./emit_invalid_owner_event.sh https://localhost:9044 01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b 8120028SFS spiffe://dune.spire.local/trade-agent-alpha
#
# The event is a signal only — no new owner is carried. The replacement owner
# is pre-configured in the IBM Verify playbook.
#
# Playbook context paths (SET subject / event payload):
#   Agent id       : @context.subject.sub_id.id@
#   Previous owner : @context.event.event_data.previous_owner@
#   Reason         : @context.event.event_data.reason_admin.en@
#
# Variant — omit PREV_OWNER_ID to emit a "no owner ever set" event:
#   ./emit_invalid_owner_event.sh https://localhost:9044 c3f91b2a-dd47-4e10-b8ca-99f21ad30c77
# ==============================================================================

set -euo pipefail

TRANSMITTER_URL="${1:-https://localhost:9044}"
AGENT_ID="${2:-01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b}"
PREV_OWNER_ID="${3:-}"
SPIFFE_ID="${4:-spiffe://dune.spire.local/trade-agent-alpha}"
ISSUE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Build optional fields only when a previous owner is provided.
if [ -n "${PREV_OWNER_ID}" ]; then
    ISSUE_KEYS="\"agent_id\": \"${AGENT_ID}\", \"agent_external_id\": \"${SPIFFE_ID}\", \"identity_id\": \"${PREV_OWNER_ID}\""
    PREVIOUS_OWNER_FIELD=", \"previous_owner\": { \"value\": \"${PREV_OWNER_ID}\", \"type\": \"User\" }"
    MESSAGE="Agent has no valid owner — the previously assigned account '${PREV_OWNER_ID}' has been deactivated."
else
    ISSUE_KEYS="\"agent_id\": \"${AGENT_ID}\", \"agent_external_id\": \"${SPIFFE_ID}\""
    PREVIOUS_OWNER_FIELD=""
    MESSAGE="Agent '${AGENT_ID}' has no owner set."
fi

echo "================================================================="
echo " Emitting 'Agent Invalid Owner' event to: ${TRANSMITTER_URL}"
echo " Agent ID        : ${AGENT_ID}"
echo " SPIFFE ID       : ${SPIFFE_ID}"
echo " Previous owner  : ${PREV_OWNER_ID:-"(none)"}"
echo "================================================================="

curl -k -i --request POST \
    --url "${TRANSMITTER_URL}/sources/vip/events" \
    --header 'Content-Type: application/json' \
    --data "{
    \"issue_id\": \"invalid-owner-$(date +%s)\",
    \"issue_keys\": { ${ISSUE_KEYS} },
    \"issue_time\": \"${ISSUE_TIME}\",
    \"issue_type\": \"Agent Invalid Owner\",
    \"playbook_name\": \"Agent with Missing or Invalid Owner\",
    \"message\": \"${MESSAGE}\",
    \"risk\": \"High\"${PREVIOUS_OWNER_FIELD}
}"

echo ""
echo "Check transmitter logs:"
echo "  tail -n 50 deploying/transmitter/container-runtime/logs/transmitter.log"
