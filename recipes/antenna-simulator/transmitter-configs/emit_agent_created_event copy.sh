#!/usr/bin/env bash
# ==============================================================================
# Script: emit_agent_created_event.sh
# Description: Pushes a sample "Agent Created" event (AuthMind-style raw event) to
#              the Antenna Transmitter. The vip_event_mapper.js transforms it into an
#              RFC 9967 SET with event urn:ietf:params:scim:event:prov:create:full.
#
# Usage:
#   ./emit_agent_created_event.sh [TRANSMITTER_URL] [DISPLAY_NAME] [SPIFFE_ID] [OWNER_ID]
#
# Examples:
#   ./emit_agent_created_event.sh
#   ./emit_agent_created_event.sh https://localhost:9044 "Test Agent C" spiffe://dune.spire.local/trade-agent 8120028SFS
#
# The agent does not exist in Verify yet, so the SET has no target id. Fields for
# playbook actions (SET subject / event payload):
#   SCIM uri   : @context.subject.sub_id.uri@          (/Agents/<authmind agent id>)
#   SPIFFE ID  : @context.subject.sub_id.externalId@
#   Agent JSON : events["urn:ietf:params:scim:event:prov:create:full"].data
# ==============================================================================

set -euo pipefail

TRANSMITTER_URL="${1:-https://localhost:9044}"
DISPLAY_NAME="${2:-Test Agent alpa}"
SPIFFE_ID="${3:-spiffe://dune.spire.local/trade-agent-alpha}"
OWNER_ID="${4:-8120028SFS}"
SOURCE_AGENT_ID="am-agent-$(date +%s)"
ISSUE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "================================================================="
echo " Emitting 'Agent Created' event to: ${TRANSMITTER_URL}"
echo " Display name    : ${DISPLAY_NAME}"
echo " SPIFFE ID       : ${SPIFFE_ID}"
echo " Owner           : ${OWNER_ID}"
echo " Source agent id : ${SOURCE_AGENT_ID}"
echo "================================================================="

curl -k -i --request POST \
    --url "${TRANSMITTER_URL}/sources/vip/events" \
    --header 'Content-Type: application/json' \
    --data "{
    \"issue_id\": \"agent-created-$(date +%s)\",
    \"issue_keys\": {
        \"authmind_agent_id\": \"${SOURCE_AGENT_ID}\",
        \"agent_external_id\": \"${SPIFFE_ID}\"
    },
    \"issue_time\": \"${ISSUE_TIME}\",
    \"issue_type\": \"Agent Created\",
    \"playbook_name\": \"Agent Created\",
    \"message\": \"Agent ${DISPLAY_NAME} was created\",
    \"risk\": \"Info\",
    \"agent\": {
        \"displayName\": \"${DISPLAY_NAME}\",
        \"description\": \"Trade Agent for Execution\",
        \"externalIds\": [\"${SPIFFE_ID}\"],
        \"owners\": [{ \"value\": \"${OWNER_ID}\", \"type\": \"User\" }],
        \"tags\": [\"langflow\", \"trade-agent\"]
    }
}"

echo ""
echo "Check transmitter logs:"
echo "  tail -n 50 deploying/transmitter/container-runtime/logs/transmitter.log"
