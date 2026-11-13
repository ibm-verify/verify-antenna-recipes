#!/usr/bin/env bash
set -euo pipefail
source scripts/00_env.sh
umask 077
jq -n --arg metadata "$NGROK_URL/.well-known/ssf-configuration" \
 --arg client "$VERIFY_CLIENT_ID" --arg secret "$VERIFY_CLIENT_SECRET" \
 --arg discovery "https://$VERIFY_TENANT_HOST/oauth2/.well-known/openid-configuration" \
 --arg patch "$PATCH_EVENT" --arg create "$CREATE_EVENT" \
 '{name:"verify-agent-registry-to-vault-scim",metadataUrl:$metadata,
 authorizationScheme:{type:"urn:ietf:rfc:6749",attributes:{grantType:"client_credentials",
 clientId:$client,clientSecret:$secret,clientAuthenticationMethod:"client_secret_post",discoveryURI:$discovery}},
 ssfStream:{delivery:{method:"urn:ietf:rfc:8936"},events_requested:[$create,$patch]}}' > receiver-stream-scim.json
curl --fail-with-body -sk -i -X POST 'https://localhost:9043/mgmt/v2.0/receivers/config' \
 -H 'Content-Type: application/json' --data-binary @receiver-stream-scim.json
