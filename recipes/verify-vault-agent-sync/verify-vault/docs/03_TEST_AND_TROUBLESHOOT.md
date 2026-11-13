# Step 3 — Test Verify → Vault synchronization end to end

**Back:** [Receiver setup](../vault-receiver/README.md) · **Start:** [Recipe README](../README.md)

In Terminal 2, work from `recipes/verify-vault/lab`; source `scripts/00_env.sh`. First run the **synthetic notification** to isolate transport, then validate the **real Verify webhook** without synthetic calls. Do not call a partial transport test "synchronization complete".

## Validate Vault synchronization from the CLI

The reliable validation is a **targeted lookup by Vault entity UUID**, not a broad `vault list agent-registry` command. An empty list result can mean no enumerable keys are returned at that path; it does not by itself prove that the synchronization failed.

For a compact read-only check, from `lab/` run:

```bash
bash scripts/validate_vault_sync.sh '<Verify-Agent-ID>'
```

This prints the matched entity and the registration by its **Vault entity UUID**, or exits with a failure. It does not create, update or delete Vault objects.

After you know the IBM Verify Agent ID (`AGENT_ID`), run from `lab/`:

```bash
source scripts/00_env.sh
: "${AGENT_ID:?Set AGENT_ID to the IBM Verify agent UUID}"
vault read -format=json "identity/entity/name/verify-agent-$AGENT_ID" > synced-entity.json
export VAULT_ENTITY_ID="$(jq -er '.data.id' synced-entity.json)"
jq '.data | {id,name,disabled,metadata,aliases}' synced-entity.json
vault read -format=json "agent-registry/registration/entity-id/$VAULT_ENTITY_ID" > synced-registration.json
jq '.data' synced-registration.json
```

**Pass criteria:** the entity is named `verify-agent-$AGENT_ID`; its UUID is captured in `VAULT_ENTITY_ID`; its alias uses the expected Verify OAuth client and accessor; and the registration lookup succeeds with matching `entity_id` and ceiling policy. The Vault entity UUID is **not** the Verify Agent ID. A successful entity read alone is not a complete registration check.

The following commands are **optional** listing diagnostics:

```bash
vault list identity/entity/id
vault list agent-registry/registration/id
vault list agent-registry/registration/display-name
```

If `vault list agent-registry/...` prints `No value found`, continue to the **targeted registration lookup** above. If the direct registration lookup returns 404, investigate the receiver's registration API call and recent logs; if it returns 403, check token permissions. Do not use an arbitrary `agent-registry/registration/<name>` path to validate the registration.

For raw HTTP status and response body:

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/agent-registry/registration/entity-id/$VAULT_ENTITY_ID"
```

After suspension, the same entity UUID should be `disabled=true` and registration lookup should return not-found. After reactivation, the entity UUID should remain unchanged, `disabled=false`, and registration lookup should succeed again.


## Create/select an agent with an eligible OAuth association

## 14. Create a dedicated agent and actor client

In Terminal 2, ensure your Step 5 token is still valid. Create the agent:

```bash
cat > agent-create.json <<'JSON'
{"schemas":["urn:ietf:params:scim:schemas:core:ibm:2.0:Agent"],"displayName":"Course Assistant Sync Lab","description":"Dedicated Verify to Vault synchronization lab","tags":["vault-sync-lab"]}
JSON
curl --fail-with-body -sS -X POST \
 "$TENANT$VERIFY_AGENT_API_PATH" \
 -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
 -H 'Accept: application/scim+json' -H 'Content-Type: application/scim+json' \
 --data-binary @agent-create.json -o agent-created.json &&
AGENT_ID=$(jq -er '.id | select(type=="string" and length>0)' agent-created.json) &&
export AGENT_ID
jq '{id,displayName,status}' agent-created.json
```

Create the OAuth actor application (DCR must be enabled for this administrative credential):

```bash
cat > actor-create.json <<'JSON'
{"client_name":"Course Assistant Sync Lab Actor","grant_types":["client_credentials"],"response_types":[],"token_endpoint_auth_method":"client_secret_post"}
JSON
curl --fail-with-body -sS -X POST "$TENANT/oauth2/register" \
 -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" -H 'Content-Type: application/json' \
 --data-binary @actor-create.json -o actor-created.json &&
ACTOR_CLIENT_ID=$(jq -er '.client_id | select(type=="string" and length>0)' actor-created.json) &&
export ACTOR_CLIENT_ID
chmod 600 actor-created.json
```

In Verify Admin Console:

1. Open **Identities → AI agents → Course Assistant Sync Lab**.
2. Edit the agent and open **Identity & authentication**.
3. Select `Course Assistant Sync Lab Actor` as its OAuth identity application and save.
4. Reopen and confirm the association.

If these UI labels differ in your tenant, use the corresponding agent/application association view. Do not put computed `oauthClients` into the agent creation payload.

Read the agent and verify the purpose-aware association:

```bash
curl --fail-with-body -sS \
 "$TENANT$VERIFY_AGENT_API_PATH/$AGENT_ID" \
 -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
 -H 'Accept: application/scim+json' -o agent-current.json
jq '{id,status,oauthClients}' agent-current.json
jq -e --arg client "$ACTOR_CLIENT_ID" \
 'any(.oauthClients[]?; .clientId==$client and ((.purposes // []) | index("agent_id") != null))' \
 agent-current.json
```

Expected: `true`. The response must actually include `purposes:["agent_id"]` on the selected client. If purposes are absent, configure the association through the supported Verify mechanism and read the agent again to confirm it is included. This guide does not invent a write to the computed oauthClients property. If the current build cannot expose purposes, this strict recipe cannot provision until that API/configuration gap is resolved.

Stop if absent/false. On an ACTIVE agent with omitted purposes the receiver raises `Association purpose unavailable` before Vault writes. That condition is no longer translated into delete. Exactly one eligible association is supported. Raw client strings in audit feedback are not proof of purpose. The agent may need review before activation; inspect its actual state rather than assuming an initial status.

**Existing-agent route:** skip POST creation and DCR if the intended agent/client already exists. A 409 conflict does not return the existing ID; do not run `export AGENT_ID=$(jq ...)` against that error body. For example, an existing agent might be selected (replace both IDs with your own):

```bash
export AGENT_ID="<YOUR_VERIFY_AGENT_ID>"
export ACTOR_CLIENT_ID="<YOUR_ACTOR_CLIENT_ID>"
```

Read the selected agent ID and confirm its display name and association before proceeding. Run the same GET and association checks. Do not use an agent whose Vault entity has unrelated policy configuration: this handler sets directly assigned entity policies to empty and uses the registration ceiling instead.


## Activate, verify initial registration

## 15. Activate and test initial synchronization

Activate the dedicated agent through your authorized Verify UI/reviewer workflow. Confirm using GET:

```bash
curl --fail-with-body -sS \
 "$TENANT$VERIFY_AGENT_API_PATH/$AGENT_ID" \
 -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
 -H 'Accept: application/scim+json' -o agent-current.json
jq -e '.status=="ACTIVE"' agent-current.json
```

For a fast test independent of the webhook subscription:

```bash
bash scripts/send_test_modification.sh
```

This sends a synthetic management notification for your real Agent ID. The receiver reads the current real agent state; changing a fixture cannot bypass Verify activation or association checks. An HTTP ingestion success alone is not a pass.

Allow at least one polling interval (start with 30 seconds):

```bash
sleep 30
docker compose logs --since=5m antenna-transmitter antenna-receiver
vault read -format=json "identity/entity/name/verify-agent-$AGENT_ID" \
 > synced-entity.json
```

Only after the read succeeds:

```bash
export VAULT_ENTITY_ID=$(jq -er '.data.id' synced-entity.json)
jq '.data | {id,name,disabled,policies,metadata,aliases}' synced-entity.json
vault read -format=json \
 "agent-registry/registration/entity-id/$VAULT_ENTITY_ID" \
 > synced-registration.json
jq '.data' synced-registration.json
```

Pass conditions:

- Entity name `verify-agent-<Verify Agent ID>`, with `disabled=false`.
- Alias name equals `ACTOR_CLIENT_ID`; mount accessor equals `VAULT_MOUNT_ACCESSOR`.
- Registration `entity_id` equals the **Vault entity UUID**, not the Verify UUID.
- Registration has the expected ceiling policy and `optional_authorization_details=false`.
- Direct entity policies are empty; the ceiling lives on the registration.

Optional registry listing (do not use an empty list as the decisive sync result):

```bash
vault list agent-registry/registration/display-name
```

If aliases are empty or registration missing, stop and inspect receiver HTTP errors, profile accessor and purpose-aware association. A visible entity alone does not prove registration succeeded.


## Modification → suspension → reactivation

## 16. Test the agent modification feedback

Edit the agent description in Verify, for example to `Updated Verify Vault lab description`, and save. For synthetic-only testing, run the synthetic script again after the real change. For webhook testing, do not run it.

```bash
sleep 30
vault read -format=json \
 "agent-registry/registration/entity-id/$VAULT_ENTITY_ID" \
 > modified-registration.json
jq '.data | {entity_id,display_name,description}' modified-registration.json
vault read -format=json "identity/entity/name/verify-agent-$AGENT_ID" \
 | jq '.data | {id,disabled}'
```

Expected: updated description and unchanged Vault entity UUID. A display-name change updates registration without renaming the stable entity.

For the **real webhook** event, inspect the received notification in ngrok. Your real event has `data.modified` as a JSON string containing attribute-keyed objects, for example:

```json
"modified":"[{\"status\":{\"new\":\"ACTIVE\",\"old\":\"SUSPENDED\"}},{\"oauthClients\":{\"new\":[\"<client-ID>\"],\"old\":null}}]"
```

The transmitter mapper parses the string first and emits replace operations using each new value. It also accepts an already parsed attribute-keyed object or supported array form. Resource ID comes from data.id/data.agentId/data.agentid; txn comes from source txn or audit id. Confirm the notification payload in the target tenant matches an accepted format.

The expected transformed modification contains:

```json
{
  "txn":"<source-transaction-or-audit-ID>",
  "sub_id":{"format":"opaque","id":"<Verify-Agent-ID>","uri":"/Agents/<Verify-Agent-ID>"},
  "events":{
    "urn:ietf:params:scim:event:prov:patch:full":{
      "data":{
        "schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        "Operations":[{"op":"replace","path":"description","value":"Updated Verify Vault lab description"}]
      }
    }
  }
}
```

Use available Antenna diagnostics to inspect the decoded, signature-verified SET and confirm the image accepts the SCIM subject and preserves `txn`. Antenna adds the signed envelope fields; the mock tests do not validate that transport behavior.


## 17. Suspend and verify removal/disable

Set the real agent to **SUSPENDED** through Verify's authorized UI. Confirm its status with the GET from Step 15, changing the jq check to `.status=="SUSPENDED"`.

If still using synthetic delivery:

```bash
bash scripts/send_test_modification.sh
```

For real webhook testing, omit that command. After one polling interval:

```bash
sleep 30
vault read -format=json "identity/entity/id/$VAULT_ENTITY_ID" \
 | jq '.data | {id,disabled,metadata,aliases}'
curl -sS --max-time 20 -o registration-after-suspend.json \
 -w '%{http_code}\n' -H "X-Vault-Token: $VAULT_TOKEN" \
 "$VAULT_ADDR/v1/agent-registry/registration/entity-id/$VAULT_ENTITY_ID"
```

Expected: same entity UUID, `disabled=true`, retained alias; registration lookup returns an explicit not-found response, normally 404. A 401/403, timeout or 5xx is a failure, not evidence of removal.

The receiver disables the entity before deleting the registration. A partial failure needs recovery/retry. This does not prove that every previously issued runtime token or external session has been revoked.


## 18. Reactivate and test repeat delivery

Reactivate the same agent with the same associated client. If using synthetic delivery, run the script once more. Wait for processing, then:

```bash
vault read -format=json "identity/entity/id/$VAULT_ENTITY_ID" \
 | jq '.data | {id,disabled,aliases}'
vault read "agent-registry/registration/entity-id/$VAULT_ENTITY_ID"
```

Expected: same entity UUID, `disabled=false`, registration recreated. Registration ID may change because it was removed during suspension.

For a repeat-reconciliation check, send another synthetic notification without changing Verify state and re-read the objects. Expected: no extra entity/registration. For true duplicate-delivery testing, replay the same captured management request in the isolated lab and verify the same convergence; the synthetic script generates a new transaction on each run.


## 19. Complete automatic end-to-end testing

Repeat these actions **without any synthetic calls**:

| Verify action | Check |
|---|---|
| Description or name update | Real webhook, patch transformation and updated registration |
| Suspension | Real webhook, disabled entity and absent registration |
| Reactivation | Real webhook, same entity enabled and registration recreated |

Correlate the real agent ID, transaction/event ID, transmitter processing, receiver processing and final Vault reads. A connection-test success or synthetic smoke test alone does not establish automatic delivery.

**Known feedback issue:** UI-only OAuth association changes may call appAccess APIs without an agent modified event. Associate before initial activation. Observe association-only edits separately; no notification is a known coverage gap, not a passing sync test. Hard deletion, multiple eligible clients, alias rotation, guaranteed ordering and reconciliation after missed events are not implemented here.


## 20. Troubleshooting, restart and cleanup

| Symptom | Next check |
|---|---|
| Vault license error | License file, valid Enterprise build and `VAULT_LICENSE_PATH` |
| OAuth/Agent Registry API 404 | Build/feature entitlement and correct API path |
| Local metadata fails | Antenna configuration and startup logs |
| Public metadata fails only | ngrok forwarding and unchanged public URL |
| Verify GET 401/403 | Token expiry and agent-read permission |
| Verify GET 404/406 | Agent endpoint, Agent ID and SCIM Accept header |
| Receiver cannot reach Vault | Host listener, `host.docker.internal`, Colima routing and port 8200 |
| No SCIM event | Audit filter, actual `data.modified`/ID shape and webhook selection |
| No polling/delivery | Stream created once and both SCIM types requested |
| Multiple eligible clients/stale alias error | Dedicated one-client agent; rotation requires reconciliation |

Inspect recent logs:

```bash
docker compose logs --since=10m antenna-transmitter antenna-receiver
```

After editing handler templates or environment settings:

```bash
bash scripts/03_render_templates.sh
docker compose up -d --force-recreate
```

Do not regenerate certificates for ordinary retries. If ngrok's URL changes, rerender Antenna configuration, update the webhook and migrate/recreate the stream through supported management with the new metadata URL. If dev Vault restarts, repeat Steps 6–7, update the accessor, rerender and reconcile the agent again.

To stop only this Antenna lab:

```bash
docker compose down
```

Retain the database and key directories while diagnosing. Disable the lab webhook and retire the test stream through supported management when finished. Stop Terminal 3 to close ngrok. Stop development Vault only when you accept losing its in-memory state.

## Record test results

Capture the installed Vault and Antenna versions, configured subject format, Verify webhook delivery result, receiver stream status, and Vault API results for each lifecycle test. Confirm the actual OAuth association purpose and ingress authentication before marking the deployment ready.


## Release acceptance checklist

- [ ] Vault API/license/feature compatibility established on installed build.
- [ ] Verify GET shows `status=ACTIVE` and eligible `oauthClients[].purposes` containing `agent_id`.
- [ ] Transmitter receives **real** webhook; receiver receives event via signed poll stream.
- [ ] Entity ID stable, alias is expected client ID, registry refers to Vault UUID, ceiling policy matches.
- [ ] Real modification updates registry; suspend disables entity/removes registration; reactivate keeps Vault UUID.
- [ ] Document exact Antenna version and whether SCIM subjects work without lab-only opaque mode.
- [ ] Security reviewed: no public Vault/receiver management endpoints or root credential in production.

**Operating scope:** The handler processes lifecycle notifications for agents with one eligible OAuth association. Bulk backfill, alias rotation and runtime secret access require separate workflows.
