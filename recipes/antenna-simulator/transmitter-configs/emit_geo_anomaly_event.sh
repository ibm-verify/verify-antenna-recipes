#!/usr/bin/env bash
# ==============================================================================
# Script: emit_geo_anomaly_event.sh
# Description: Pushes an "Access to Unauthorized Countries" event to the
#              Antenna Transmitter. The vip_event_mapper.js transforms it
#              into a SET carrying:
#                CAEP risk-level-change
#
# Usage:
#   ./emit_geo_anomaly_event.sh [TRANSMITTER_URL] [USER_ID] [AGENT_ID]
#
# Examples:
#   ./emit_geo_anomaly_event.sh
#   ./emit_geo_anomaly_event.sh https://localhost:9044
#   ./emit_geo_anomaly_event.sh https://localhost:9044 8120028SFS 01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b
#
# IBM Verify playbook subject paths:
#   Agent ID   : @context.subject.sub_id.agent.id@
#   User ID    : @context.subject.sub_id.user.id@    (opaque IBM Verify user ID)
# ==============================================================================

set -euo pipefail

TRANSMITTER_URL="${1:-https://localhost:9044}"
USER_ID="${2:-8120028SFS}"
AGENT_ID="${3:-01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b}"
ISSUE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "================================================================="
echo " Emitting 'Access to Unauthorized Countries' event to: ${TRANSMITTER_URL}"
echo " → SSF: CAEP risk-level-change"
echo " User ID  : ${USER_ID}"
echo " Agent ID : ${AGENT_ID}"
echo "================================================================="

curl -k -i --request POST \
    --url "${TRANSMITTER_URL}/sources/vip/events" \
    --header 'Content-Type: application/json' \
    --data "{
    \"flow_count\": 2,
    \"incident_count\": 1,
    \"issue_id\": \"183682-$(date +%s)\",
    \"issue_keys\": {
        \"identity_id\": \"${USER_ID}\",
        \"agent_id\": \"${AGENT_ID}\"
    },
    \"issue_time\": \"${ISSUE_TIME}\",
    \"issue_type\": \"Access to Unauthorized Countries\",
    \"message\": \"${USER_ID} accessed a geo-blocked or sanctioned country\",
    \"playbook_name\": \"Access to Unauthorized Countries\",
    \"risk\": \"High\"
}"

echo ""
echo "================================================================="
echo " IBM Verify playbook subject paths:"
echo "   Agent ID   : @context.subject.sub_id.agent.id@"
echo "   User ID    : @context.subject.sub_id.user.id@    (opaque IBM Verify user ID)"
echo ""
echo " Check transmitter logs:"
echo "   tail -n 50 deploying/transmitter/container-runtime/logs/transmitter.log"
echo "================================================================="
