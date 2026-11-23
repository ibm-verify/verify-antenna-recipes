#!/usr/bin/env bash
# ==============================================================================
# Script: emit_anomalous_access_event.sh
# Description: Pushes a sample "Anomalous Agent Access" event (AuthMind-style
#              raw event) to the Antenna Transmitter. The vip_event_mapper.js
#              transforms it into a SET carrying:
#                urn:ibm:agent:anomalous_access
#
# Usage:
#   ./emit_anomalous_access_event.sh [TRANSMITTER_URL] [AGENT_ID] [IDENTITY_ID] [IDENTITY_NAME] [ASSET_TYPE] [ASSET_ID] [IP_ADDRESS]
#
# Examples:
#   ./emit_anomalous_access_event.sh
#   ./emit_anomalous_access_event.sh https://localhost:9044 am-agent-7f3c1d 8120028SFS rupesh.kapse@ibm.com database prod-db-01 192.168.55.21
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
IDENTITY_ID="${3:-8120028SFS}"
IDENTITY_NAME="${4:-rupesh.kapse@ibm.com}"
ASSET_TYPE="${5:-database}"
ASSET_ID="${6:-prod-db-01}"
IP_ADDRESS="${7:-192.168.55.21}"
ISSUE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TS_NOW="$(date +%s)000"

echo "================================================================="
echo " Emitting 'Anomalous Agent Access' event to: ${TRANSMITTER_URL}"
echo " Agent ID        : ${AGENT_ID}"
echo " Identity ID     : ${IDENTITY_ID}"
echo " Identity name   : ${IDENTITY_NAME}"
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
        \"identity_id\": \"${IDENTITY_ID}\",
        \"identity_name\": \"${IDENTITY_NAME}\",
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
