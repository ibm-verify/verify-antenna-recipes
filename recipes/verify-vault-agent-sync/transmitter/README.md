# IBM Agent Identity Transmitter Recipe

This recipe configures an existing IBM Verify Antenna transmitter to convert IBM Agent Identity management notifications into provisioning events for the [Vault receiver](../vault-receiver/README.md).

## Overview

The transmitter receives successful agent creation and modification notifications from Verify. It converts modifications into SCIM patch operations and delivers signed Security Event Tokens (SETs) through an SSF stream.

The supplied mapper explicitly sets `var subjectFormat = "opaque";` and emits an opaque subject containing the stable Verify Agent ID. The receiver script explicitly expects the same mode. The SCIM event URI and PatchOp payload are retained, but the opaque subject is a compatibility exception to RFC 9967. The tested Antenna 26.03.0 receiver rejected `scim` subjects.

## Prerequisites

- An existing Antenna transmitter with working storage, HTTPS listener, SET signing keys and public discovery URL.
- Verify tenant with IBM Agent Identity and management notification access.
- Verify API client permitted to read agents; required when constructing a creation event.
- A configured notification route from Verify to this transmitter.

## Configuration

1. Copy [custom_events.yml](configs/custom_events.yml) into the transmitter configuration directory beside `transmitter.yml`. Keep its `version: "26.03"` header.
2. Edit the configuration constants near the top of [verify_agent_registry_mapper.js](configs/js/verify_agent_registry_mapper.js):

| Constant | Set to |
|---|---|
| tenantHost | Verify hostname without https:// |
| clientId / clientSecret | Verify API client permitted to read agents |
| agentApiPath | Agent endpoint verified for your tenant; default /v1.0/Agents |
| subjectFormat | Keep opaque |

3. Copy the edited handler into the existing transmitter's configs/js directory and copy the supplied custom_events.yml beside transmitter.yml. There is no environment file or rendering step.

If that filename already holds other custom definitions, merge these entries into the existing top-level `custom_event_types` list instead of replacing them. Preserve unrelated service configuration.

4. Add these values to `transmitter.event_types`:

```yaml
- "urn:ietf:params:scim:event:prov:create:full"
- "urn:ietf:params:scim:event:prov:patch:full"
```

5. Add the source under `transmitter.ingester.sources` (or update your existing source of the same ID):

```yaml
- id: push_src_1
  type: http_push
  transform_rule:
    type: javascript
    content: "@js/verify_agent_registry_mapper.js"
```

6. Reload/restart the existing transmitter using its deployment procedure. Check startup logs for successful custom-event validation and processing readiness. Keep its existing signing keys, storage and stream authorization.

For an existing Kubernetes deployment, mount the handler and custom-event YAML in the configured paths through the deployment's ConfigMaps/secret-rendering process, then roll out the change. This recipe does not supply a base deployment.

## Configure Verify notifications

In Verify's notification webhook configuration, select successful agent management creation/modification notifications and set the destination to:

```text
https://<your-transmitter-public-host>/sources/push_src_1/events
```

Send JSON (`Content-Type: application/json`) and configure authentication to match the existing ingress. Event-selection labels depend on the tenant UI. The modification mapper requires `event_type=management`, `data.resource=ai_agent`, `data.action=modified`, and `data.result=success`. A connection-test payload alone does not create a Vault identity.

## Explaining the internals

`data.modified` may be a JSON string containing attribute-keyed change objects. The mapper parses it and converts each change into `op:replace`, `path:<attribute>`, `value:<new value>`. The patch's `data.schemas` contains only `urn:ietf:params:scim:api:messages:2.0:PatchOp`.

Supported attributes are displayName, description, externalIds, owners, tags, status and oauthClients. Arrays and empty arrays are preserved. Creation events retrieve the complete current agent from Verify. Subject ID comes from the agent resource ID; transaction ID comes from source txn or audit ID.

## Testing

1. Complete the paired receiver recipe and stream registration.
2. Change the description of a dedicated ACTIVE agent in Verify.
3. Confirm webhook receipt, transformation and SET delivery in transmitter logs.
4. Confirm the expected Vault state using the receiver's verification commands.

## Troubleshooting

- Unsupported event URI or empty configuration version: check the supplied custom-event YAML is loaded with its version header.
- Transformation failure: check the real audit fields and `data.modified` structure.
- No delivery: check discovery, authorization and the stream's requested event types.
- UI-only OAuth association changes may not emit an agent-modified event. A subsequent status change can include OAuth changes; this recipe does not add a missing notification source or periodic reconciliation.
