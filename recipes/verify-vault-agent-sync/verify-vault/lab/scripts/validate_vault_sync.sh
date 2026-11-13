#!/usr/bin/env bash
# Read-only Vault identity + Agent Registry validation for an IBM Verify agent.
set -euo pipefail
[[ -f scripts/00_env.sh ]] || { echo 'Run from recipes/verify-vault/lab'; exit 2; }
source scripts/00_env.sh
AGENT_ID="${1:-${AGENT_ID:-}}"
[[ -n "$AGENT_ID" ]] || { echo 'Usage: bash scripts/validate_vault_sync.sh <Verify-Agent-ID>'; exit 2; }
[[ "$AGENT_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Invalid Verify Agent ID format'; exit 2; }
command -v vault >/dev/null || { echo 'Vault CLI not found on PATH'; exit 2; }
command -v jq >/dev/null || { echo 'jq not found'; exit 2; }
: "${VAULT_TOKEN:?VAULT_TOKEN must be configured}"
if [[ "$VAULT_TOKEN" == CHANGEME* ]]; then echo 'Fill VAULT_TOKEN in scripts/00_env.sh'; exit 2; fi
umask 077
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
entity_name="verify-agent-$AGENT_ID"
echo "Reading Vault entity: $entity_name"
if ! vault read -format=json "identity/entity/name/$entity_name" > "$out/entity.json"; then
  echo 'Entity not found or unreadable; verify AGENT_ID and receiver event processing.'; exit 1
fi
entity_id="$(jq -er '.data.id | select(type=="string" and length>0)' "$out/entity.json")"
jq '.data | {id,name,disabled,metadata,aliases}' "$out/entity.json"
echo "Vault entity UUID: $entity_id"
echo 'Reading Agent Registry registration by Vault entity UUID:'
if ! vault read -format=json "agent-registry/registration/entity-id/$entity_id" > "$out/registration.json"; then
  echo 'Registration lookup failed; inspect receiver logs. A successful entity read alone is not enough.'; exit 1
fi
jq '.data' "$out/registration.json"
echo 'PASS: Entity and registration both readable. Review alias, entity_id and ceiling policy fields above.'
