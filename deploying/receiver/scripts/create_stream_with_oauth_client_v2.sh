#!/bin/bash

CLIENT_ID="NOT_A_VALID_VALUE"
CLIENT_SECRET="NOT_A_VALID_VALUE"
OIDC_METADATA_URL="https://tenant.verify.ibm.com/oauth2/.well-known/openid-configuration"
RECEIVER_HOSTNAME="receiver.dune.com"
TRANSMITTER_METADATA_URL="https://transmitter.dune.com:9044/.well-known/ssf-configuration"

payload=$(cat <<EOF
{
	"name": "$RECEIVER_HOSTNAME",
	"metadataUrl": "$TRANSMITTER_METADATA_URL",
	"authorizationScheme": {
		"type": "urn:ietf:rfc:6749",
		"attributes": {
			"grantType": "client_credentials",
			"clientId": "$CLIENT_ID",
			"clientSecret": "$CLIENT_SECRET",
			"clientAuthenticationMethod": "client_secret_post",
			"discoveryURI": "$OIDC_METADATA_URL"
		}
	},
	"ssfStream": {
		"delivery": {
			"method": "urn:ietf:rfc:8936"
		},
		"events_requested": [
			"https://schemas.openid.net/secevent/caep/event-type/session-revoked",
			"https://schemas.openid.net/secevent/caep/event-type/credential-change"
		]
	}
}
EOF
)


curl -k --request POST \
  --url https://$RECEIVER_HOSTNAME:9043/mgmt/v2.0/receivers/config \
  --header 'Content-Type: application/json' \
  --data "$payload"
