# CAEP.Dev Receiver Recipe

This recipe demonstrates how to configure and deploy IBM Verify Antenna as a receiver for CAEP.Dev events, with a focus on handling session revocation events.

## Overview

CAEP.Dev is a simulator for testing Continuous Access Evaluation Protocol (CAEP) events. This recipe configures IBM Verify Antenna to:

1. Receive session revocation events from CAEP.Dev
2. Process these events using a custom action handler
3. Perform automated actions in IBM Verify, including:
   - Revoking user sessions
   - Resetting user passwords

## Prerequisites

- IBM Verify tenant: Sign up for a free trial at [ibm.biz/verify-trial](https://ibm.biz/verify-trial)
- Account on CAEP.Dev and an access token for registering streams
- A container runtime like Docker or Podman installed

## Deployment

Follow the instructions in [Container Runtime Deployment](../../../deploying/receiver/container-runtime/README.md) to set up the basic IBM Verify Antenna receiver. Stop at building the directory structure, as you'll need to add additional files specific to this recipe.

## Configuration

### Create an API Client in IBM Verify

1. Create a new API client in IBM Verify using the instructions provided in the [IBM Verify documentation](https://www.ibm.com/docs/en/security-verify?topic=access-creating-api-clients). Choose the following entitlements:
   - Read users and groups
   - Reset password of any user
   - Revoke all sessions for a user

2. Copy the client ID and secret from the API client you created.

3. Create or identify a user in the Cloud Directory identity source realm. Note the username, as you'll use it later for testing. Ensure that it has a valid email address.

### Configure the Session Revoked Action Handler

1. Copy the [session_revoked.js](configs/js/session_revoked.js) file to your `antenna-receiver/configs/js/` directory.

2. Modify the following properties in the `session_revoked.js` file:
   - `TENANT`: Your IBM Verify tenant hostname
   - `CLIENT_ID`: The API client ID created in the previous section
   - `CLIENT_SECRET`: The API client secret created in the previous section

### Update the Receiver Configuration

1. Open `antenna-receiver/configs/receiver.yml`.

2. Ensure that the `session-revoked` event type is configured under `receiver.runtime.action_rules`.

3. Set the `content` property for this event type to `"@js/session_revoked.js"`.

### Update the Receiver Deployment File

1. Open `antenna-receiver/receiver-deployment.yaml`.
2. Find the configMap with `name: receiver-action-handlers`
3. Add a new element under the "items" entry for `session_revoked.js` as:
   ```
   - configMap:
       name: receiver-action-handlers
       items:
         - key: log_event.js
           path: js/log_event.js
         - key: session_revoked.js     # Added for caep-dev verify-receiver scenario
           path: js/session_revoked.js # Added for caep-dev verify-receiver scenario
   ```
Note: If the receiver and/or Config Maps have already been deployed, make sure to delete and recreate them to reflect the changes.

### Complete the Receiver Setup

Follow the remaining instructions in the [Container Runtime Deployment](../../../deploying/receiver/container-runtime/README.md) guide to complete the receiver configuration and deployment.

## Registering with CAEP.Dev

To register your receiver with CAEP.Dev:

1. Copy the [create_stream_with_token.sh](../../../deploying/receiver/scripts/create_stream_with_token.sh) script to your local machine.

2. Modify the script with the following properties:
   ```bash
   ACCESS_TOKEN="<CAEP.Dev Token>"
   RECEIVER_HOSTNAME="receiver.dune.com"  # Update with your receiver hostname
   TRANSMITTER_METADATA_URL="https://ssf.caep.dev/.well-known/ssf-configuration"
   ```

3. Run the script to register your receiver with CAEP.Dev.

## Testing

To test the session revocation flow:

1. Go to CAEP.Dev

2. Click "Start transmitting"

3. Enter your CAEP.Dev access token and click Submit

4. Configure the event:
   - Set "Event Type" to `Session Revoked`
   - Set "Subject type" to `Email`
   - Set "Email" to the username of the account you created in IBM Verify

5. Click "Send CAEP Event"

6. Verify the results:
   - Check the receiver logs to see the event being processed
   - Confirm that the user's sessions have been revoked
   - Verify that the user's password has been reset (the user should receive an email)

## How It Works

The session revocation flow works as follows:

1. CAEP.Dev sends a session revocation event to your IBM Verify Antenna receiver
2. The receiver processes the event using the `session_revoked.js` action handler
3. The action handler:
   - Authenticates with IBM Verify using the API client credentials
   - Finds the user that matches the subject in the event
   - Revokes all active sessions for that user
   - Resets the user's password and triggers a notification email

## Customization

You can customize this recipe by:

1. Modifying the `session_revoked.js` handler to perform different actions
2. Adding handlers for other CAEP event types
3. Integrating with additional systems beyond IBM Verify

## Troubleshooting

- Check the receiver logs for errors
- Verify that the API client has the correct entitlements
- Ensure the user exists in IBM Verify with the exact username specified in the event subject's email attribute
- Check that the CAEP.Dev token is valid

## Next Steps

After successfully deploying the CAEP.Dev receiver:

1. Explore other event types supported by CAEP.Dev
2. Implement additional action handlers for different security scenarios

