#!/usr/bin/env bash
set -euo pipefail
source scripts/00_env.sh

curl -sk -i -X POST "https://${HOST_IP}:${TX_PORT}/sources/push_src_1/events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "management",
    "servicename": "application_access",
    "data": {
      "action": "modified",
      "resource": "application",
      "applicationid": "3823394705883248910",
      "applicationname": "OpenID Connect_Agent hai",
      "modified": "[{\"companyName\":{\"old\":\"agent\",\"new\":\"customer\"}}]"
    }
  }'

echo

echo "Sent delete/disable test. Wait for RX poll interval, then validate Vault disabled=true."
