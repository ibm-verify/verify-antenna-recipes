# IBM Verify SaaS — Antenna Receiver Setup

Before the Antenna Receiver in IBM Verify SaaS can act on the NHI events emitted by this simulator, the custom **event types** and their associated **playbooks** must be configured in the Verify SaaS tenant.

All required configuration files are located under [`verify-saas-configs/`](../verify-saas-configs/).

---

## Create Playbooks

1. Go to **Shared Signals > Playbooks**.
2. Click on the import icon beside the **Create playbook** button.
3. Provide the playbook name and select the playbook file to upload. Refer to the table below.
4. For some playbooks, further customization needs to be done. Refer to the table below.
5. Click on the **Publish** button.

| File | Name/Reference | Purpose | Customization |
|---|---|---|---|
| [`agentcreation.json`](../verify-saas-configs/playbooks/agentcreation.json) | `agentcreation` | Register a new agent identity in IBM Verify | None |
| [`assign_ownership.json`](../verify-saas-configs/playbooks/assign_ownership.json) | `assign_ownership` | Assign or reassign an owner to an agent | Set the "Owner" to a user who will be the default owner for your agents. |
| [`suspend_agentidentity.json`](../verify-saas-configs/playbooks/suspend_agentidentity.json) | `suspend_agentidentity` | Suspend an agent identity | None |
| [`session_revoked.json`](../verify-saas-configs/playbooks/session_revoked.json) | `session_revoked` | Revoke OAuth grants / user sessions | None |

---

## Create Event Types

1. Go to **Shared Signals > Event types**.
2. Click on **Create event type**.
3. Select one of the templates to start from.
    - For "Credential Compromise" and "Risk Level Change", select the **Credential Compromise** and **Risk Level Change** event types respectively.
    - For the other event types, select **Other**.
4. Set the name, URI, and JSON schema of this event type.
    - For "Credential Compromise", this can be left as the default.
    - For "Risk Level Change", modify only the JSON schema. See table below.
    - For the other event types, use the contents of the files provided. See table below for each JSON schema file.
5. Click on **Add default action** and select the appropriate playbook for that event type. See the table below.

| Event type name | Event type URI | JSON schema | Playbook |
|---|---|---|---|
| Credential Compromise | `https://schemas.openid.net/secevent/risc/event-type/credential-compromise` | Use default | `session_revoked` |
| Risk Level Change | `https://schemas.openid.net/secevent/caep/event-type/risk-level-change` | Overwrite the default with [`verify-saas-configs/event_types/risk-level-change.json`](../verify-saas-configs/event_types/risk-level-change.json) | `suspend_agentidentity` |
| Shadow Agent Detected | `urn:ibm:agent:unregistered_agent` | [`verify-saas-configs/event_types/Unregistered Agent.json`](../verify-saas-configs/event_types/Unregistered%20Agent.json) | `agentcreation` |
| Anomalous Asset Access | `urn:ibm:agent:anomalous_access` | [`verify-saas-configs/event_types/Anomalous Access.json`](../verify-saas-configs/event_types/Anomalous%20Access.json) | `suspend_agentidentity` |
| Agent with Invalid Owner | `urn:ibm:agent:invalid_owner` | [`verify-saas-configs/event_types/Invalid Owner.json`](../verify-saas-configs/event_types/Invalid%20Owner.json) | `assign_ownership` |

---

## Create Event Stream

1. Go to **Shared Signals > Event streams**.
2. Click on **Create event stream**.
3. Provide a name for the stream, and the metadata URL of the transmitter. The metadata URL would be `https://<your-ngrok-domain>.ngrok-free.dev/.well-known/ssf-configuration`. Click on the **Verify** button to verify that the transmitter is reachable.
4. Select **Push** for the delivery method and click **Next**.
5. Select **Client secret POST** and fill in the client ID. For the purpose of the demo, you can use the same client ID as the one in your transmitter.
6. For the client secret, select the **default** secret group name, and then click on the dropdown for Secret name and select **Create secret**. Give this secret a name and set the value to the client secret value.
7. Fill in the **Discovery URL** as `https://<your-tenant>.verify.ibmcloudsecurity.com/oauth2/.well-known/openid-configuration`. Click **Next**.
8. Click **Connect** and select all 5 event types created for this demo. Click **Add** and then **Next**.
9. Click **Save** to create this stream.
