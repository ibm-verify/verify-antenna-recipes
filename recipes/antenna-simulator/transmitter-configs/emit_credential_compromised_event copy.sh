#!/usr/bin/env bash
# ==============================================================================
# Script: emit_credential_compromised_event.sh
# Description: Pushes a "Compromised User" event to the Antenna Transmitter.
#              The vip_event_mapper.js transforms it into a SET carrying:
#                RISC credential-compromise
#
# Usage:
#   ./emit_credential_compromised_event.sh [TRANSMITTER_URL] [USER_ID] [AGENT_ID]
#
# Examples:
#   ./emit_credential_compromised_event.sh
#   ./emit_credential_compromised_event.sh https://localhost:9044
#   ./emit_credential_compromised_event.sh https://localhost:9044 rupesh.kapse@ibm.com 01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b
#   ./emit_credential_compromised_event.sh https://localhost:9044 802004QYSO 01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b
#
# IBM Verify playbook subject paths:
#   Agent ID   : @context.subject.sub_id.agent.id@
#   User ID    : @context.subject.sub_id.user.id@    (opaque / non-email)
#   User email : @context.subject.sub_id.user.email@ (email format)
# ==============================================================================

set -euo pipefail

TRANSMITTER_URL="${1:-https://localhost:9044}"
USER_ID="${2:-rupesh.kapse@ibm.com}"
AGENT_ID="${3:-01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b}"
ISSUE_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo "================================================================="
echo " Emitting 'Compromised User' event to: ${TRANSMITTER_URL}"
echo " → SSF: RISC credential-compromise"
echo " User ID  : ${USER_ID}"
echo " Agent ID : ${AGENT_ID}"
echo "================================================================="

curl -k -i --request POST \
    --url "${TRANSMITTER_URL}/sources/vip/events" \
    --header 'Content-Type: application/json' \
    --data "{
    \"flow_count\": 1,
    \"incident_count\": 1,
    \"issue_id\": \"185321-$(date +%s)\",
    \"issue_keys\": {
        \"identity_name\": \"${USER_ID}\",
        \"agent_id\": \"${AGENT_ID}\"
    },
    \"issue_time\": \"${ISSUE_TIME}\",
    \"issue_type\": \"Compromised User\",
    \"message\": \"${USER_ID} credentials were found in one or more data breaches\",
    \"playbook_name\": \"Compromised User\",
    \"risk\": \"Critical\"
}"

echo ""
echo "================================================================="
echo " IBM Verify playbook subject paths:"
echo "   Agent ID   : @context.subject.sub_id.agent.id@"
echo "   User ID    : @context.subject.sub_id.user.id@    (opaque / non-email)"
echo "   User email : @context.subject.sub_id.user.email@ (email format)"
echo ""
echo " Check transmitter logs:"
echo "   tail -n 50 deploying/transmitter/container-runtime/logs/transmitter.log"
echo "================================================================="
