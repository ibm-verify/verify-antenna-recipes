# Step 2 — HashiCorp Vault receiver recipe

**Back:** [Transmitter](../transmitter/README.md) · **Next:** [Lifecycle test](../docs/03_TEST_AND_TROUBLESHOOT.md)

## Purpose

Antenna receiver subscribes to the transmitter's polling stream for SCIM create and patch notifications, then invokes [vault_agent_registry_action.js](configs/js/vault_agent_registry_action.js). This handler re-fetches the current Verify agent to avoid trusting incomplete notification payloads and reconciles the corresponding Vault identity and registration.

| Verify state | Vault action |
|---|---|
| ACTIVE + exactly one OAuth association with `agent_id` purpose | Create/update entity, OAuth alias and registry record |
| SUSPENDED / other non-ACTIVE or no eligible association | Disable existing entity, delete registration; keep alias |
| ACTIVE again with same eligible client | Re-enable same entity and re-register |
| ACTIVE but purpose metadata missing | **Error; no deprovisioning based on missing data** |

Entity name: `verify-agent-<Verify Agent ID>`; alias: **associated OAuth client ID** bound to actual Vault OAuth profile accessor; registration uses Vault entity UUID. Keep these distinct—do not silently change identity mapping. One eligible association only; changes of client ID need additional reconciliation design.

## Required Vault access

- Correct licensed Vault build, feature activation and OAuth profile: https://developer.hashicorp.com/vault/ai/iam/setup-agent
- Agent Registry endpoints: https://developer.hashicorp.com/vault/ai/iam/reference/agent-reg-summary
- ACL policy design: https://developer.hashicorp.com/vault/docs/concepts/policies
- Entity API: https://developer.hashicorp.com/vault/api-docs/secret/identity/entity
- Alias API: https://developer.hashicorp.com/vault/api-docs/secret/identity/entity-alias

**Production permission design:** create a dedicated, short-lived/safely managed provisioning identity scoped to identity entity/alias and `agent-registry` operations, and to the relevant Vault namespace. The included **local dev mode uses `VAULT_TOKEN=root` only as a laboratory shortcut**; do not transplant it into a deployed setup. The registration ceiling policy is a separate permission boundary and does not authorize the synchronization writer itself.

## Receiver configuration

`../lab/configs/receiver/configs/receiver.yml.template` subscribes to both event types, and invokes `@js/vault_agent_registry_action.js`. Its custom events registration is `../lab/configs/receiver/configs/custom_events.yml.template`. The common `../lab/scripts/00_env.sh` supplies Verify API client, Vault address, token, namespace, accessor, policy and subject format. Use the *rendered* configs in `../lab/deploying/receiver`.

## Configure receiver connectivity and stream

### 1. Verify local, public and Vault connectivity

```bash
curl --fail-with-body -sk --max-time 20 \
 https://localhost:9044/.well-known/ssf-configuration \
 -o antenna-local-metadata.json
jq . antenna-local-metadata.json
curl --fail-with-body -sS --max-time 20 \
 "$NGROK_URL/.well-known/ssf-configuration" \
 -o antenna-public-metadata.json
jq . antenna-public-metadata.json
```

Expected: both return metadata JSON using the public URL and advertising the two SCIM event types. Local failure means Antenna/startup configuration; public-only failure means ngrok/routing.

Try the receiver-to-Vault checkpoint:

```bash
docker compose exec antenna-receiver sh -c \
 'curl -sS --max-time 10 http://host.docker.internal:8200/v1/sys/health'
```

Expected: initialized/unsealed health JSON. If the image lacks shell/curl, use the receiver's actual Vault call result in Step 15 as the network checkpoint. DNS, timeout or connection refusal is a blocker; verify Colima/Docker host routing and your host listener. Mac-side `vault status` alone does not prove container access.

The lab uses `-k` only for self-signed local Antenna listeners. The ngrok endpoint is HTTPS with its public certificate.


### 2. Create receiver subscription

From `recipes/verify-vault/lab`:

```bash
bash scripts/create_scim_stream.sh
docker compose logs --tail=100 antenna-receiver
```

Expected: successful management response and polling established. The script saves `receiver-stream-scim.json` and requests:

```text
urn:ietf:params:scim:event:prov:create:full
urn:ietf:params:scim:event:prov:patch:full
```

Create this stream once. Do not repeatedly create duplicates on every retry. The receiver-management endpoint is local lab infrastructure; do not expose it through ngrok.

If the receiver already has a subscription, inspect its requested event types and use the supported receiver-management API to update it rather than creating duplicate streams. The subscription must request both SCIM event types.


## Verification checkpoint

```bash
docker compose ps
docker compose logs --tail=100 antenna-receiver
```

Receiver receives signed SETs through a polling subscription. Do **not** expose `https://localhost:9043/mgmt/v2.0/receivers/config` on the public internet. A registered stream is only a delivery checkpoint; successful Vault mutation must be confirmed in the next guide.

**Continue to:** [Step 3 — lifecycle test](../docs/03_TEST_AND_TROUBLESHOOT.md).
