#!/usr/bin/env bash
# ==============================================================================
# Script: emit_anomalous_access_event.sh
# Description: Pushes a sample "Anomalous Agent Access" event (AuthMind-style
#              raw event) to the Antenna Transmitter. The vip_event_mapper.js
#              transforms it into a SET carrying:
#                urn:ibm:agent:anomalous_access
#
# Usage:
#   ./emit_anomalous_access_event.sh [TRANSMITTER_URL] [AGENT_ID] [USER_ID] [ASSET_TYPE] [ASSET_ID] [IP_ADDRESS]
#
# Examples:
#   ./emit_anomalous_access_event.sh
#   ./emit_anomalous_access_event.sh https://localhost:9044 am-agent-7f3c1d 8120028SFS database prod-db-01 192.168.55.21
#
# Playbook context paths (SET subject / event payload):
#   Agent id    : @context.subject.sub_id.agent.id@
#   User id     : @context.subject.sub_id.user.id@
#   Session ip  : @context.subject.sub_id.session.id@
#   Asset type  : @context.event.event_data.asset_type@
#   Asset id    : @context.event.event_data.asset_id@
#   Timestamps  : @context.event.event_data.incident_timestamps@
# ==============================================================================

set -euo pipefail

TRANSMITTER_URL="${1:-https://localhost:9044}"
AGENT_ID="${2:-01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b}"
USER_ID="${3:-8120028SFS}"
ASSET_TYPE="${4:-database}"
ASSET_ID="${5:-prod-db-01}"
IP_ADDRESS="${6:-192.168.55.21}"
ISSUE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TS_NOW="$(date +%s)000"

echo "================================================================="
echo " Emitting 'Anomalous Agent Access' event to: ${TRANSMITTER_URL}"
echo " Agent ID        : ${AGENT_ID}"
echo " User ID         : ${USER_ID}"
echo " Asset type      : ${ASSET_TYPE}"
echo " Asset ID        : ${ASSET_ID}"
echo " IP address      : ${IP_ADDRESS}"
echo "================================================================="

curl -k -i --request POST \
    --url "${TRANSMITTER_URL}/sources/vip/events" \
    --header 'Content-Type: application/json' \
    --data "{
    \"issue_id\": \"anomalous-access-$(date +%s)\",
    \"issue_keys\": {
        \"agent_id\": \"${AGENT_ID}\",
        \"identity_id\": \"${USER_ID}\",
        \"asset_type\": \"${ASSET_TYPE}\",
        \"asset_id\": \"${ASSET_ID}\",
        \"ip_address\": \"${IP_ADDRESS}\"
    },
    \"issue_time\": \"${ISSUE_TIME}\",
    \"issue_type\": \"Anomalous Agent Access\",
    \"playbook_name\": \"AI Agents Accessing Unapproved Asset\",
    \"message\": \"Agent '${AGENT_ID}' accessed ${ASSET_TYPE} '${ASSET_ID}' outside its approved resource scope.\",
    \"risk\": \"High\",
    \"incident_timestamps\": [${TS_NOW}]
}"

echo ""
echo "Check transmitter logs:"
echo "  tail -n 50 deploying/transmitter/container-runtime/logs/transmitter.log"
