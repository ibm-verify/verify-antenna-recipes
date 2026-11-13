# Step 1 — IBM Verify Agent Identity transmitter recipe

**Back:** [Preparation](../docs/00_PREPARE.md) · **Next:** [Vault receiver](../vault-receiver/README.md)

## Purpose

The Verify tenant emits successful `ai_agent` management notifications. The Antenna HTTP push source passes these to [verify_agent_registry_mapper.js](configs/js/verify_agent_registry_mapper.js), producing SCIM `create:full` or `patch:full` events. A signed SSF polling stream subsequently delivers them to the receiver. 

## Prerequisites

- Complete [Step 0](../docs/00_PREPARE.md), especially Verify credential and Vault OAuth profile.
- Docker + Compose; ngrok for a cloud Verify tenant reaching local Antenna.
- API read rights on `/v1.0/Agents` (verify your tenant); notification webhook admin rights.
- See [official Antenna transmitter container deployment](https://github.com/ibm-verify/verify-antenna-recipes/tree/main/deploying/transmitter/container-runtime) for alternative setup. The included `../lab` provides the concrete Docker deployment for this recipe.

## Transmitter mapping and configuration

- Source ID: `push_src_1`, `http_push`, mapper: `@js/verify_agent_registry_mapper.js`.
- Event types: `urn:ietf:params:scim:event:prov:create:full` and `urn:ietf:params:scim:event:prov:patch:full`.
- The template for the actual container is `../lab/configs/transmitter/configs/transmitter.yml.template` and custom events are in `../lab/configs/transmitter/configs/custom_events.yml.template`.
- Do not copy or run source JS without filling and rendering the lab environment; the complete lab scripts create the active `deploying/transmitter` config and its certificates.

## Start HTTPS tunnel and deploy Antenna

### 1. Start ngrok

Why: your cloud Verify tenant must reach the local transmitter over HTTPS. ngrok forwards to the transmitter, not to Vault.

In **Terminal 3**, obtain your ngrok account authtoken and run:

```bash
ngrok config add-authtoken '<your-ngrok-authtoken>'
ngrok http https://localhost:9044
```

Keep this terminal running. Read the forwarding line, for example:

```text
Forwarding  https://example.ngrok-free.app -> https://localhost:9044
```

Copy **only** the public URL on the left: `https://example.ngrok-free.app`. Do not copy the arrow, localhost URL or an extra path. The public route may report upstream errors until Antenna starts.


### 2. Configure integration environment

In Terminal 2:

```bash
nano scripts/00_env.sh
```

Set these values using the outputs from the preceding steps:

| Setting | Enter |
|---|---|
| `NGROK_URL` | Public HTTPS URL from Terminal 3, no trailing slash |
| `VERIFY_TENANT_HOST` | Tenant hostname only |
| `VERIFY_CLIENT_ID` / `VERIFY_CLIENT_SECRET` | API credential from Step 5 |
| `VERIFY_AGENT_API_PATH` | Confirmed path, initially `/v1.0/Agents` |
| `VAULT_ADDR_HOST` | `http://127.0.0.1:8200` |
| `VAULT_ADDR_FROM_ANTENNA` | `http://host.docker.internal:8200` for this lab |
| `VAULT_TOKEN` | `root` |
| `VAULT_NAMESPACE` | Empty string |
| `VAULT_POLICY` | `verify-agent-ceiling` |
| `VAULT_OAUTH_PROFILE` | `verify` |
| `VAULT_CONFIG_ID` | `config_id` returned by the live Vault profile read |
| `VAULT_MOUNT_ACCESSOR` | Exact accessor derived in Step 6 |
| `VAULT_AGENT_REGISTRY_CEILING_FIELD` | `ceiling_policies` (confirm against the installed Vault API) |

For this Antenna 26.03.0 lab, use **`SUBJECT_FORMAT="opaque"`** consistently in both handlers and stream configuration. This is a compatibility mode; validate the standards-based SCIM format independently before switching. Do not change this value halfway through an existing stream test.

Keep `PATCH_EVENT`, `CREATE_EVENT`, container names and ports as supplied. Quote literal credential values correctly in the shell file; the renderer handles subsequent JavaScript escaping.

Save with Ctrl+O, Enter, Ctrl+X. Then:

```bash
chmod 600 scripts/00_env.sh
source scripts/00_env.sh
export TENANT="https://$VERIFY_TENANT_HOST"
printf '%s\n' "$NGROK_URL" "$VAULT_ADDR" "$VAULT_MOUNT_ACCESSOR"
```

Expected: actual values with no `CHANGEME` placeholders. Do not print the secret/token.


### 3. Generate certificates and start Antenna

This sequence launches the dedicated Antenna containers. Check for occupied ports or conflicting container names before starting.

Check potential conflicts:

```bash
docker ps -a --filter name=verify-vault-agent-registry \
 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

If a stopped container already uses one of these names, rename it before deploying. For a transmitter, for example:

```bash
docker rename verify-vault-agent-registry-transmitter \
 "verify-vault-agent-registry-transmitter-backup-$(date +%Y%m%d%H%M%S)"
```

Do the equivalent for the receiver only if it exists. An absent container needs no rename.

From `recipes/verify-vault/lab`:

```bash
mkdir -p db-tx db-rx
bash scripts/02_generate_san_certs.sh
bash scripts/03_render_templates.sh
docker compose config --quiet
docker compose pull
docker compose up -d
sleep 60
docker compose ps
docker compose logs --tail=100 antenna-transmitter antenna-receiver
```

Expected: both services running without configuration/initialization errors. Allow the containers to complete initialization. On ARM, inspect any actual image/emulation failure; an architecture warning alone does not prove a crash.

Generate certificates once for this environment. Do not regenerate signing keys merely to retry delivery. The renderer creates `docker-compose.yml` and the active `deploying/` configurations, including **custom_events.yml for both services**, from supplied templates. Each custom-event file includes `version: "26.03"`. The SCIM event URIs must be registered in Antenna's local catalogue before advertising/handling them. Registering their schemas does not add SCIM subject support.

The local SQLite configuration uses one worker per single-partition processing stage to avoid an idle second worker repeatedly reporting no available partition. Startup can still require partition assignment to settle. A `partitioner not ready` message alone is not a reason to delete state. Check for `is ready` and actual event processing before diagnosing a startup problem. Do not repeatedly restart while waiting.

The renderer creates all active files; you do not need to create JavaScript files manually.


## Configure IBM Verify notification webhook

### 4. Create webhook

In Verify Admin Console:

1. Open **Integrations → Notification webhooks**.
2. Create/open a dedicated webhook named `Agent_Sync`.
3. Under **Connection details → URLs and authentication**, enter the full destination:

```text
https://<your-ngrok-host>/sources/push_src_1/events
```

4. Add custom header `Content-Type: application/json`.
5. Keep outgoing/incoming transformations unset for this mapper.
6. Select successful agent management notifications for creation and modification. The mapper's modification filter is:

```text
 event_type = management
 data.resource = ai_agent
 data.action = modified
 data.result = success
```

7. Configure webhook authentication consistently with what the transmitter ingress enforces, save and test the connection.

**Before proceeding:** Verify that the selected notification categories are available in the tenant and that the webhook authentication mechanism matches the Antenna HTTP ingress configuration. The SSF polling-stream OAuth settings do not protect the webhook ingress. Complete the synthetic test in the lifecycle guide if agent notifications are not yet available, then test a real notification.

Open `http://localhost:4040/inspect/http` on the Mac. Confirm the request reaches `/sources/push_src_1/events`. A connection test such as `{"test":true}` should not provision an agent; only a real supported management event supplies an agent identity.


## Transmitter verification

```bash
curl --fail-with-body -sk https://localhost:9044/.well-known/ssf-configuration | jq .
curl --fail-with-body -sS "$NGROK_URL/.well-known/ssf-configuration" | jq .
docker compose logs --tail=100 antenna-transmitter
```

Expected: local and public SSF metadata, both SCIM event types advertised, receiver able to poll once registered. A webhook connection test by itself is **not** proof of synchronization.

IBM webhook help: https://www.ibm.com/docs/en/security-verify?topic=interface-creating-notification-webhook

**Continue to:** [Step 2 — receiver](../vault-receiver/README.md).
