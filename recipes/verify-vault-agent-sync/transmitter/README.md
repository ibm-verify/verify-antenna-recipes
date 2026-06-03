# IBM Verify Application-to-Agent Transmitter Recipe

This recipe demonstrates how to configure and deploy IBM Verify Antenna as a transmitter for IBM Verify application lifecycle events that represent agent identity changes. The transmitter processes IBM Verify application management audit events, evaluates whether the application is classified as an agent, and transforms the event into a standardized SSF event whose payload contains a SCIM-style `Agent` resource.

## Overview

IBM Verify applications may be used to represent AI agents or automation clients. In this recipe, an application is treated as an agent when its application metadata contains `companyName=agent`.

This recipe configures IBM Verify Antenna to:

1. Receive raw IBM Verify application management events.
2. Read the current application state from IBM Verify when the audit payload does not contain the full classification metadata.
3. Transform the event into an SSF event using the CAEP `session-revoked` event URI as the accepted carrier event type.
4. Emit a payload that contains a minimal SCIM-style Agent resource instead of a Verify application-shaped payload.
5. Transmit the resulting event to registered receivers.

## Prerequisites

- IBM Verify tenant.
- IBM Verify Antenna transmitter deployment.
- IBM Verify API client with permission to read application configuration.
- Container runtime or Kubernetes deployment using the standard IBM Verify Antenna setup.
- A receiver configured to subscribe to the CAEP `session-revoked` event URI.

## Deployment Options

You can deploy this transmitter recipe using the standard IBM Verify Antenna deployment method.

### Option 1: Container Runtime

Follow the standard container runtime deployment instructions for the IBM Verify Antenna transmitter, with the following recipe-specific modifications.

1. Copy the `verify_app_agent_mapper.js` transformation handler from this recipe into your transmitter configuration directory:

   ```bash
   cp recipes/verify-vault-agent-sync/transmitter/configs/js/verify_app_agent_mapper.js \
      antenna-transmitter/configs/js/verify_app_agent_mapper.js
   ```

2. Modify `transmitter.yml` to include the event type used by this recipe:

   ```yaml
   transmitter:
     event_types:
       - "https://schemas.openid.net/secevent/caep/event-type/session-revoked"
   ```

3. Configure the IBM Verify webhook source to use the mapper:

   ```yaml
   transmitter:
     ingester:
       sources:
         - id: verify_app_audit
           type: http_push
           transform_rule:
             type: javascript
             content: "@js/verify_app_agent_mapper.js"
   ```

4. Configure the mapper with the IBM Verify tenant and API client details required to read the current application state when needed.

### Option 2: Kubernetes

Follow the standard Kubernetes deployment instructions for IBM Verify Antenna, with the same recipe-specific changes:

1. Add `verify_app_agent_mapper.js` to the transmitter transform handler ConfigMap.
2. Mount the mapper under the transmitter `configs/js` path.
3. Add the CAEP `session-revoked` event type to the transmitter event type configuration.
4. Configure the Verify application audit source to use `@js/verify_app_agent_mapper.js`.

## Explaining the Internals

### Agent Event Mapper

The `verify_app_agent_mapper.js` file contains the transformation logic for IBM Verify application lifecycle events.

The mapper performs the following work:

1. Reads the incoming IBM Verify application audit event.
2. Extracts the application ID and application name.
3. Checks whether the application is classified as an agent using `companyName=agent`.
4. If the audit event does not contain the current classification value, calls the IBM Verify application API to read the current state.
5. Generates an SSF event with the accepted CAEP carrier URI:

   ```text
   https://schemas.openid.net/secevent/caep/event-type/session-revoked
   ```

6. Places a SCIM-style `Agent` resource inside the event body:

   ```json
   {
     "operation": "upsert",
     "resource": {
       "resourceType": "Agent",
       "id": "255028952879348172",
       "name": "OpenID Connect_scim_format",
       "schemas": [
         "urn:ietf:params:scim:schemas:extension:ibm:2.0:Agent"
       ]
     }
   }
   ```

### Why the Payload Uses Agent Instead of Application

The source event today is an IBM Verify application audit event, but the receiver should not be coupled to a Verify application-shaped payload. The receiver only needs to know the agent identity that must be synchronized to Vault.

For that reason, the mapper converts the application audit input into a minimal Agent resource. If a future IBM Verify Agent Registry or agent audit event source emits agent lifecycle events directly, the receiver contract can remain unchanged.

### Event URI Note

The lab uses the CAEP `session-revoked` event URI because it is accepted by the validated Antenna stream registration flow. The event URI is used as the SSF carrier. The business meaning is carried by the embedded payload:

- `operation=upsert` means create or update the Vault identity alias.
- `operation=delete` means disable or remove the Vault identity alias.
- `resource.resourceType=Agent` identifies the payload as an Agent resource.

## Testing

Use the provided test scripts to verify the transmitter mapper behavior.

### Test Agent Upsert Event

`test_agent_upsert_event.sh` simulates a Verify application event where the application is classified as an agent.

```bash
./scripts/test_agent_upsert_event.sh
```

Expected result:

- The transmitter receives the raw event.
- The mapper logs `SCIM AGENT PAYLOAD`.
- The mapper emits an SSF event containing `resourceType=Agent` and `operation=upsert`.

### Test Agent Delete Event

`test_agent_delete_event.sh` simulates a Verify application event where the agent classification has been removed or is not present.

```bash
./scripts/test_agent_delete_event.sh
```

Expected result:

- The transmitter receives the raw event.
- The mapper emits an SSF event containing `resourceType=Agent` and `operation=delete` or disable semantics.

## Verification

After running the test scripts or triggering a real Verify application change, verify the transmitter logs.

Look for:

```text
verify_app_agent_mapper.js SCIM AGENT PAYLOAD
Generated SCIM Agent event
```

and confirm the emitted event contains:

```json
"resource": {
  "id": "<agent-id>",
  "name": "<agent-name>",
  "resourceType": "Agent"
}
```

Also confirm the transmitter reports that the event is requested by a registered stream:

```text
Event https://schemas.openid.net/secevent/caep/event-type/session-revoked ... is requested by the following streams
```

## Customization

You can customize this recipe by:

1. Changing the classification attribute from `companyName` to another Verify application attribute.
2. Adding additional Agent attributes if required by the downstream receiver.
3. Replacing the application audit source with a future Agent Registry audit source while preserving the same SCIM Agent event payload.

Keep the receiver contract stable by preserving this minimum resource shape:

```json
{
  "resource": {
    "resourceType": "Agent",
    "id": "<agent-id>",
    "name": "<agent-name>"
  }
}
```

## Troubleshooting

- Check transmitter logs for mapper execution errors.
- Verify that the IBM Verify API client can read the current application configuration.
- Confirm the application contains `companyName=agent` when testing upsert.
- Confirm the stream is subscribed to `https://schemas.openid.net/secevent/caep/event-type/session-revoked`.
- If stream creation fails with `invalid event URI`, use the validated CAEP `session-revoked` carrier URI for this recipe.

## Next Steps

After the transmitter successfully emits Agent SCIM-shaped events:

1. Configure the Vault receiver recipe to subscribe to the same event type.
2. Add the Vault action handler that reads `resource.resourceType`, `resource.id`, and `resource.name`.
3. Trigger a real IBM Verify application create or modify event.
4. Validate that the Vault entity and entity alias are created or updated.
