#!/usr/bin/env bash
set -euo pipefail
source scripts/00_env.sh
: "${AGENT_ID:?Export the dedicated Verify lab Agent ID}"
umask 077
jq -n --arg id "$AGENT_ID" --arg audit "local-test-$(python3 -c 'import uuid; print(uuid.uuid4())')" \
 '{id:$audit,event_type:"management",data:{resource:"ai_agent",id:$id,action:"modified",result:"success",
 modified:{description:{new:"Synthetic reconciliation notification; current Verify state is authoritative"}}}}' > synthetic-modification.json
curl --fail-with-body -sk -i -X POST 'https://localhost:9044/sources/push_src_1/events' \
 -H 'Content-Type: application/json' --data-binary @synthetic-modification.json
