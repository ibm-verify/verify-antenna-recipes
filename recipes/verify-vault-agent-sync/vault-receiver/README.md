# HashiCorp Vault Receiver Recipe for IBM Verify Agent Sync Events

This recipe is complementary to the IBM Verify Application-to-Agent Transmitter Recipe. It demonstrates how to configure IBM Verify Antenna as a receiver for Agent SCIM-shaped SSF events and synchronize those agent identities into HashiCorp Vault entity aliases.

## Overview

The transmitter recipe converts IBM Verify application lifecycle events into SSF events containing a minimal Agent resource. This receiver recipe consumes those events and performs Vault identity synchronization.

This receiver recipe shows how to:

1. Receive standardized SSF events from the transmitter.
2. Process CAEP `session-revoked` carrier events using the `vault_entity_alias_action.js` action handler.
3. Read the embedded SCIM-style Agent resource.
4. Create, update, disable, or remove Vault identity records using the Agent ID and Agent name.

This creates a complete automation workflow from Verify application classification to Vault identity synchronization.

## Prerequisites

- IBM Verify Antenna receiver deployment.
- HashiCorp Vault reachable from the receiver container or runtime host.
- Vault token or authentication mechanism with permission to manage identity entities and aliases.
- A transmitter configured with the IBM Verify Application-to-Agent Transmitter Recipe.
- Receiver stream subscribed to:

  ```text
  https://schemas.openid.net/secevent/caep/event-type/session-revoked
  ```

## Deployment

Follow the standard container runtime deployment instructions for IBM Verify Antenna receiver. Stop at building the directory structure, then add the files from this recipe.

## Configuration

### Configure Vault Access

The receiver action handler requires Vault connectivity and a token with sufficient permissions.

Typical Vault capabilities required:

```hcl
path "identity/entity" {
  capabilities = ["create", "update", "read"]
}

path "identity/entity/name/*" {
  capabilities = ["read", "create", "update"]
}

path "identity/entity-alias" {
  capabilities = ["create", "update", "read"]
}

path "identity/entity-alias/id/*" {
  capabilities = ["read", "update", "delete"]
}
```

Update the Vault connection values in the action handler or inject them through the supported Antenna runtime configuration pattern used in your deployment.

### Configure the Vault Action Handler

1. Copy the `vault_entity_alias_action.js` file from this recipe to your receiver JavaScript configuration directory:

   ```bash
   cp recipes/verify-vault-agent-sync/vault-receiver/configs/js/vault_entity_alias_action.js \
      antenna-receiver/configs/js/vault_entity_alias_action.js
   ```

2. Configure the following properties according to your Vault environment:

   - Vault address
   - Vault token or auth method
   - Vault identity mount path
   - Vault entity naming convention
   - Vault alias mount accessor, if required by your Vault identity model

### Update the Receiver Configuration

Open `antenna-receiver/configs/receiver.yml` and add or modify the action rule for the event type used by this recipe:

```yaml
receiver:
  runtime:
    action_rules:
      - event_type: "https://schemas.openid.net/secevent/caep/event-type/session-revoked"
        type: javascript
        content: "@js/vault_entity_alias_action.js"
```

## Registering with the Transmitter

Register the receiver stream with the transmitter and request the event type used by this recipe.

The stream registration payload must include:

```json
{
  "events_requested": [
    "https://schemas.openid.net/secevent/caep/event-type/session-revoked"
  ]
}
```

In the validated lab, attempts to use `token-claims-change` for stream registration returned an invalid event URI error. For this recipe, use the validated CAEP `session-revoked` carrier event URI and let the action handler interpret the embedded Agent payload.

## How It Works

The Vault synchronization flow works as follows:

1. The transmitter sends an SSF event to the receiver.
2. The event uses the CAEP `session-revoked` URI as the accepted carrier event type.
3. The event body contains a SCIM-style Agent resource:

   ```json
   {
     "operation": "upsert",
     "resource": {
       "resourceType": "Agent",
       "id": "255028952879348172",
       "name": "OpenID Connect_scim_format"
     }
   }
   ```

4. The receiver invokes `vault_entity_alias_action.js`.
5. The action handler validates that `resource.resourceType` is `Agent`.
6. The action handler reads:

   - `resource.id` as the Agent ID / Vault alias value.
   - `resource.name` as the Agent display name / Vault entity naming input.
   - `operation` as the action to perform.

7. For `operation=upsert`, the handler creates or updates the Vault entity and entity alias.
8. For `operation=delete`, the handler disables or removes the Vault identity mapping according to the configured logic.

## Testing

To test the receiver:

1. Trigger the transmitter upsert test or create a real IBM Verify application with `companyName=agent`.
2. Confirm the receiver receives the event.
3. Confirm the receiver action handler logs the parsed Agent resource.
4. Confirm Vault entity and alias creation.

Expected receiver log indicators:

```text
vault_entity_alias_action.js SCIM AGENT UPSERT DELETE
operation=upsert agentId=<id> agentName=<name> resourceType=Agent
UPSERT FLOW START
Vault POST identity/entity status=200 OK
Vault POST identity/entity-alias status=200 OK
UPSERT COMPLETE
```

## Verification

Validate in Vault:

```bash
vault list identity/entity/name
vault read identity/entity/name/verify-agent-<agent-name>
vault list identity/entity-alias/id
```

Expected result:

- A Vault entity exists for the synchronized agent.
- A Vault alias exists using the Agent ID as the alias value.
- The alias is associated with the expected canonical entity ID.

## Why the Receiver Uses Agent Resource Instead of Application Fields

The receiver should not depend on whether the upstream source is an IBM Verify application audit event, a future Agent Registry audit event, or another agent lifecycle source. It should only depend on the normalized payload contract.

The stable contract is:

```json
{
  "resource": {
    "resourceType": "Agent",
    "id": "<agent-id>",
    "name": "<agent-name>"
  }
}
```

This allows the transmitter source to change in the future without changing the receiver action logic.

## Next Steps

After successfully deploying the Vault receiver:

1. Add additional Vault policy assignment logic if different agent types require different policies.
2. Add support for richer Agent SCIM attributes when the Agent Registry schema becomes available.
3. Replace the current application audit input with true agent audit events when available, while preserving the same normalized Agent resource payload.
4. Extend the delete/disable path based on the Vault identity lifecycle model required for production.

## Troubleshooting

- Check receiver logs for action handler errors.
- Confirm the stream is subscribed to the same event URI emitted by the transmitter.
- Confirm the event body contains `resource.resourceType=Agent`.
- Confirm the Vault token has sufficient identity management privileges.
- Confirm Vault is reachable from the receiver container.
- If the event is received but Vault does not change, check the parsed `operation`, `agentId`, and `agentName` log line.
