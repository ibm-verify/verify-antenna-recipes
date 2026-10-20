# HashiCorp Vault Receiver Recipe for IBM Agent Identity

This recipe complements the [transmitter recipe](../transmitter/README.md). It configures an existing Antenna receiver to synchronize governed agents into an already configured HashiCorp Vault deployment.

## Overview

The receiver reads current agent state from Verify and maintains a Vault entity, OAuth alias and Agent Registry registration.

| Current Verify state | Action |
|---|---|
| ACTIVE with exactly one explicit agent_id-purpose client | Create/update identity, alias and registration |
| ACTIVE with no eligible client | Skip; no Vault writes |
| SUSPENDED, DRAFT or UNDER_REVIEW | Disable existing entity and remove its registration |
| Reactivated with the same association | Re-enable the same entity UUID and recreate registration |

Associations without purposes or with other purposes are ignored. The recipe does not create an OAuth client or assign its purpose. More than one eligible client is rejected.

## Prerequisites

- Existing Antenna receiver with working listener, storage and SSF verification/polling configuration.
- Paired transmitter running and reachable through HTTPS discovery.
- Verify API credential permitted to read the target agent.
- Licensed Vault supporting the OAuth resource-server and Agent Registry APIs used by this handler.
- Existing Verify OAuth profile, actual namespace/profile accessor and ceiling ACL policy.
- Vault provisioning credential authorized for the required entity, alias and registration operations.
- Network access from the receiver to Verify, Vault and the transmitter.
- curl and jq for stream setup and verification.

Both supplied handlers explicitly set `var subjectFormat = "opaque";`, the observed 26.03.0 compatibility mode. This is not RFC 9967 SCIM-subject compliance.

## Configuration

1. Edit the configuration constants near the top of [vault_agent_registry_action.js](configs/js/vault_agent_registry_action.js):

| Constant | Set to |
|---|---|
| tenantHost | Verify hostname without https:// |
| clientId / clientSecret | Credential permitted to read the target agent |
| agentApiPath | Agent endpoint verified for the tenant |
| vaultAddr | Vault base URL reachable from the receiver |
| vaultToken | Authorized Vault provisioning token |
| vaultPolicy | Existing ceiling ACL policy name |
| mountAccessor | Actual OAuth profile accessor for the chosen namespace |
| ceilingField | ceiling_policies for the demonstrated build |
| vaultNamespace | Empty for root, otherwise the intended namespace |
| subjectFormat | Keep opaque, matching the transmitter |

2. Copy the edited handler into the existing receiver's configs/js directory. Copy the supplied custom_events.yml beside receiver.yml. No environment file or renderer is required. When entering a literal JavaScript string, escape embedded quotes and backslashes correctly. Protect the configured files as credentials.

If custom_events.yml already defines other events, merge the supplied entries into its `custom_event_types` list. Keep the version header and unrelated configuration.

3. Add both types under `receiver.event_types`:

```yaml
- "urn:ietf:params:scim:event:prov:create:full"
- "urn:ietf:params:scim:event:prov:patch:full"
```

4. Add rules under `receiver.runtime.action_rules`:

```yaml
- event_type: "urn:ietf:params:scim:event:prov:create:full"
  type: javascript
  content: "@js/vault_agent_registry_action.js"
- event_type: "urn:ietf:params:scim:event:prov:patch:full"
  type: javascript
  content: "@js/vault_agent_registry_action.js"
```

5. Reload/restart the existing receiver through its deployment procedure. Preserve its keys and database. For Kubernetes, mount the same handler/schema and apply the equivalent configuration changes through the existing deployment workflow.

## Registering with the transmitter

Use your existing supported stream-management procedure. Set the transmitter metadata URL and request both types above using polling delivery (`urn:ietf:rfc:8936`). Update an existing subscription rather than repeatedly creating duplicates.

For a new stream, create this request using your deployment values. The OAuth credential must be accepted by the transmitter; it may differ from the agent-read credential.

```bash
umask 077
export TX_METADATA_URL='https://<transmitter-host>/.well-known/ssf-configuration'
export RX_MANAGEMENT_URL='https://<receiver-host>/mgmt/v2.0/receivers/config'
export STREAM_CLIENT_ID='<stream-OAuth-client-ID>'
export STREAM_CLIENT_SECRET='<stream-OAuth-client-secret>'
export STREAM_DISCOVERY_URI='https://<Verify-host>/oauth2/.well-known/openid-configuration'
jq -n --arg metadata "$TX_METADATA_URL" \
 --arg client "$STREAM_CLIENT_ID" --arg secret "$STREAM_CLIENT_SECRET" \
 --arg discovery "$STREAM_DISCOVERY_URI" \
 '{name:"verify-agent-registry-to-vault",metadataUrl:$metadata,
 authorizationScheme:{type:"urn:ietf:rfc:6749",attributes:{grantType:"client_credentials",
 clientId:$client,clientSecret:$secret,clientAuthenticationMethod:"client_secret_post",discoveryURI:$discovery}},
 ssfStream:{delivery:{method:"urn:ietf:rfc:8936"},events_requested:[
 "urn:ietf:params:scim:event:prov:create:full","urn:ietf:params:scim:event:prov:patch:full"]}}' \
 > receiver-stream.json
```

POST this JSON to the existing management endpoint using its configured authentication. For a bearer-protected management deployment:

```bash
export RX_MANAGEMENT_TOKEN='<receiver-management-bearer-token>'
curl --fail-with-body -sS -i -X POST "$RX_MANAGEMENT_URL" \
 -H "Authorization: Bearer $RX_MANAGEMENT_TOKEN" \
 -H 'Content-Type: application/json' --data-binary @receiver-stream.json
```

If your management endpoint uses a different authentication method, use that method; omit the Authorization header only when the existing deployment explicitly permits unauthenticated management. Retain trusted TLS verification. Create the stream once, check the response and confirm polling in receiver logs. These shell variables are only for the optional curl request; neither handler reads environment variables.

## How it works

The handler validates the event and performs an authoritative Verify GET. It selects only the client explicitly marked `agent_id`. Verify read failures or unknown status stop processing before Vault writes.

Entity name is `verify-agent-<Verify Agent ID>`. Alias name is the selected client ID with the configured profile accessor. Registration entity_id is the Vault-generated UUID; the ceiling policy is attached to registration with optional_authorization_details=false. Recipe-owned entity policies are empty. Use dedicated entities, because this sets their direct policy list.

Suspension disables before deleting registration. Entity/aliases remain for reactivation. Multi-client rotation, hard deletion and periodic reconciliation are outside this recipe.

## Testing and verification

Use a dedicated ACTIVE agent with exactly one eligible client. Change its description through Verify, allow event processing and read:

```bash
export AGENT_ID='<Verify-Agent-ID>'
vault read -format=json "identity/entity/name/verify-agent-$AGENT_ID" > entity.json
```

After successful read:

```bash
export VAULT_ENTITY_ID=$(jq -er '.data.id' entity.json)
jq '.data | {id,disabled,aliases}' entity.json
vault read "agent-registry/registration/entity-id/$VAULT_ENTITY_ID"
```

Expected: enabled entity, selected client alias/accessor, and registration with the intended ceiling and Vault UUID. Suspend through Verify and confirm the same entity has disabled=true and registration is explicitly absent. Reactivate and confirm the same UUID is enabled and registration returns. A transport acknowledgement alone does not prove Vault success.

## Troubleshooting

- Subject-format error: confirm both rendered handlers use opaque and trigger a fresh event.
- No identity: inspect current source status and explicit agent_id association; unrelated clients should not block it.
- Vault 401/403/404: check provisioning permission, API availability, namespace and accessor.
- Alias conflict/rotation: reconcile existing bindings; this recipe does not automatically remap another identity's alias.
