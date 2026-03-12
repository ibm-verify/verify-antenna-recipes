#!/bin/bash

ACCESS_TOKEN="NOT_A_VALID_VALUE"
RECEIVER_HOSTNAME="receiver.dune.com"
TRANSMITTER_METADATA_URL="https://transmitter.dune.com:9044/.well-known/ssf-configuration"

payload=$(cat <<EOF
{
	"name": "$RECEIVER_HOSTNAME",
	"metadataUrl": "$TRANSMITTER_METADATA_URL",
	"authorizationScheme": {
		"type": "urn:ietf:rfc:6750",
		"attributes": {
			"accessToken": "$ACCESS_TOKEN"
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
