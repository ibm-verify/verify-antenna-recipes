# CAEP.Dev Receiver Recipe - IBM Verify SaaS

This recipe demonstrates how to configure IBM Verify SaaS as a CAEP event receiver. It is the SaaS counterpart to the [CAEP.Dev Receiver Recipe](../verify-receiver/README.md).

Instead of deploying an IBM Verify Antenna container with a custom JavaScript handler, this recipe leverages the native **Shared Signals** capability built into IBM Verify, combined with **Playbooks** to process CAEP events using visual workflows.

## Overview

CAEP.Dev is a simulator for testing Continuous Access Evaluation Protocol (CAEP) events. This recipe configures IBM Verify SaaS Antenna to:

1. Receive session revocation events from CAEP.Dev
2. Trigger a Playbook that:
   - Disables the application linked to the event subject
   - Revokes all active OAuth grants for the affected user

## Prerequisites

- IBM Verify SaaS tenant: Sign up for a free trial at [ibm.biz/verify-trial](https://ibm.biz/verify-trial)
- Account on CAEP.Dev and an access token for registering streams

## Configuration

### Configure the Session Revoked Response Playbook

The Playbook performs two steps in sequence: it disables the application associated with the event subject and revokes all active OAuth grants for the affected user.

1. Select `Antenna` > `Playbooks`.

2. Select `Import` on the top right corner.

3. Put `SessionRevokedResponse` in the `Flow name` field.

4. Select `Drag and drop a file or click to upload`.

5. Upload the [sessionrevokedresponse.json](configs/sessionrevokedresponse.json) file.

6. Select `Import flow`.

7. Select `Save draft` and `Publish changes`.


### Setup the Session Revoked Event Type in Antenna

1. Select `Antenna` > `Event types`.
2. Create an event type.

    a) Select `Create event type`.

    b) Search for `Session Revoked` and select the event type.

    c) Select `Next`.

    d) On the `Configure event type` page, select `Next`.

    e) On the `Setup response` page, select `SessionRevokedResponse`.

    f) Select `Save`. 
    
### Create a secret for storing the CAEP.dev token

1. Select `Security` > `Secrets`.
2. Create a secret.

    a) Select `Create secret`.

    b) Put a name in the `Secret name` field (e.g. `caep-token`).

    c) Select an available `Secret group`.

    d) Paste in your CAEP.dev token in the `Secret value` field.

    e) Select `Create`.

### Setup the Event Stream in Antenna

1. Select `Antenna` > `Event streams`.
2. Create an event stream.
    
    a) Select `Create event stream`.

    b) Put a name in the `Event stream name` (e.g. `CAEP event stream`).
    
    c) Paste `https://ssf.caep.dev/.well-known/ssf-configuration` in the `Metadata URL` field and select `Verify`.

    d) Select `Next`.

    e) Keep the standard values for `Delivery method`.

    f) Select `Next`.

    g) For `Authenticate transmitter`, select `Bearer token`.

    h) Select the `Secret group name` you chose previously.

    i) Select the secret storing the CAEP.dev token from the `Secret name` dropdown.

    j) Select `Next`.

    k) Select `Connect`.

    l) Select the `Session Revoked` event type.

    m) Select `Add`.

    n) Select `Save`.

## Testing the end-to-end workflow

### Set up test data

Before sending a test event, you need an application and a user with active OAuth grants on your tenant. The Playbook will disable the application and revoke the grants - so these need to exist for the test to be meaningful.

**1. Create a test application**

1. Select `Applications` > `Applications`.
2. Select `Add application`.
3. Choose `OpenID Connect` and select `Add application`.
4. Provide a `Company name` of your choice. 
5. Switch to the `Sign-on` tab and disable `Authorization code` under the `Grant types` category.
6. Enable `Resource owner password credential (ROPC)` under the `Grant types` category.
7. Select `Save`.
8. Switch back to the `Sign-on` tab.
9. Store the `Client ID` and `Client secret` values for later use.
10. Select `Applications` > `Applications`.
11. Search for your newly created application and select the `Settings` icon on the right.
12. Locate and store the `application ID` from the URL for later use, e.g.: `https://my-tenant.verify.com/ui/admin/application/<application_ID>?tab=general`.

**2. Create a test user**

1. Select `Identities` > `Users & groups`.
2. Select `Add user`.
3. Select `Cloud Directory` from the `Identity provider` dropdown menu.
4. Put a name in the `User name` field (e.g. `caep-user`).
5. Put in your e-mail address in the `Preferred e-mail` field.
6. Select `Save`.
7. You will receive an email to reset the users password. Follow the instructions and store the `User name` as well as the new `Password` for later use.
8. Select `Identities` > `Users & groups`.
9. Search for your newly created user and select the `User details` icon on the right.
10. Store the `User ID` for later use.

**3. Grant the user access to the application (OAuth grant)**

Use the IBM Verify token endpoint to create an OAuth grant and tokens for the user so the `Delete OAuth grant` task has something to revoke:

1. Set the following variables:

```bash
TENANT=""        # e.g. my-tenant.verify.com
CLIENT_ID=""     # Client ID of the application
CLIENT_SECRET="" # Client secret of the application
USERNAME=""      # Username of the test user
PASSWORD=""      # Password of the test user
```

2. Run the following command to create an OAuth grant:

```bash
curl -X POST "https://$TENANT/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "username=$USERNAME" \
  -d "password=$PASSWORD" \
  -d "scope=openid"
```

3. Go to `Security` > `OIDC tokens` to verify that the grant was created successfully.

> After the Playbook runs, verify that the grants were revoked by returning to `Security` > `OIDC tokens`. The active grants list should be empty.

---

### Send a test event from CAEP.Dev

1. Go to [caep.dev](https://caep.dev).
2. Select `Start transmitting`.
3. Enter your CAEP.Dev access token and select `Submit`.
4. Configure the event:
   - **Event Type:** `Session Revoked`
   - **Subject type:** `Complex`
   - Add a Complex Subject **Application** → `Opaque` → Id: your IBM Verify application ID
   - Add a Complex Subject **User** → `Opaque` → Id: the IBM Verify user ID whose grants should be revoked
5. Select `Send CAEP Event`.
6. Verify the results:

| What to check | Where to look | Expected result |
|---------------|---------------|-----------------|
| Event delivered to IBM Verify SaaS | CAEP.dev → Logs → Event log | Event appears with status `Generated`, `Polled` & `Acknowledged` |
| Application disabled | IBM Verify SaaS → Applications → Applications → Search for your application | Enabled status `Disabled` |
| OAuth grant deleted | IBM Verify SaaS → Security → OIDC tokens → Search for your application | Active grants list is empty |

---

## How it works

1. CAEP.Dev sends a `session-revoked` event to the IBM Verify SaaS.
2. IBM Verify SaaS matches the event to the configured event type and starts the `SessionRevokedResponse` Playbook, injecting the event payload as context.
3. The Playbook executes two tasks in sequence:
   - **Modify application status**: disables the application associated with the event subject.
   - **Delete OAuth grant**: revokes all active OAuth grants for that user.

---

### How workflow context works

Any context key can be referenced inside a task input using the macro syntax `@context.<key>@`. The workflow engine resolves the macro to its current value before the task executes. `@context.subject.sub_id@` contains the `sub_id` that caep.dev sent to IBM Verify SaaS. For example, `@context.subject.sub_id.application.id@` in the `Application ID` field of `Modify application status` is replaced at runtime with the application ID from the incoming CAEP event.

Tasks can also **write back** into the context via their declared outputs. For instance, the `Modify application status` task writes `applicationState` into the context after it runs.

| Context key | Source | Used by |
|---|---|---|
| `subject.sub_id.application.id` | CAEP event payload | `ModifyApplicationStatus` → `applicationId` input |
| `subject.sub_id.user.id` | CAEP event payload | `DeleteOAuthGrant` → `userId` input |
| `applicationState` | Output of `Modify application status` task | Available for downstream tasks or logging |

---

## Customization

1. **Change the response**: add, remove, or reorder tasks in the Playbook to match your use case.
2. **Handle additional event types**: create a separate Playbook for `credential-change` or `token-claims-change` events and map each to its own event type.

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| IBM Verify SaaS tenant does not have **Antenna** in the navigation menu | Feature `VDEV-147351` is not active for this tenant | Contact IBM Verify support to enable the feature |
| Event stream active but no Playbook triggered | Event type not linked to the Playbook | Check `Antenna` > `Event types` and confirm the response is set to `SessionRevokedResponse` |
| Playbook fails at `Modify application status` | Application ID not found or invalid | Confirm `@context.subject.sub_id.application.id@` resolves correctly from the CAEP event payload |
| Playbook fails at `Delete OAuth grant` | User ID not found or invalid | Confirm `@context.subject.sub_id.user.id@` is present in the CAEP event subject |

> **Tip:** Turn on tracing from the Playbook or Event Stream configuration to trace and debug any issues with the Playbook.

---

## Next Steps

1. Explore additional CAEP event types (`credential-change`, `token-claims-change`) and create a workflow for each.
2. Build a recovery Playbook that re-enables the application once the risk is cleared.
