# Step 0 — Prepare IBM Verify, Vault and Docker

## Objective

Prepare an IBM Verify tenant and an appropriately licensed HashiCorp Vault installation for agent lifecycle synchronization. At the end of this step, Vault is running, Verify API credentials are available, the Vault OAuth profile exists, an agent ceiling policy is defined, and the local lab environment file is ready for the transmitter.

**Next:** [Step 1 — Transmitter](../transmitter/README.md). For installation and API concepts, see [official documentation URLs](OFFICIAL_LINKS.md).

## 1. Start in the correct directory

Extract the package. Open Terminal 2 and navigate into the recipe directory (**not** the Vault binary directory). Replace the example path with your own extracted location:

```bash
cd "/path/to/verify-antenna-recipes/recipes/verify-vault"
pwd
node tests/test_handlers.cjs   # Optional; offline only, requires Node.js
cd lab
pwd
umask 077
```

`node tests/test_handlers.cjs` must run from the **recipe root**. If already inside `lab/`, use `node ../tests/test_handlers.cjs`. Passing these offline tests does not verify live Verify/Vault connectivity.

Use Terminal 1 for the Vault server, Terminal 2 for commands in `lab/`, and Terminal 3 for ngrok during the transmitter setup. Unless stated otherwise, commands below run from `recipes/verify-vault/lab/`.

## 2. Install prerequisites

- Licensed Vault Enterprise with the OAuth resource-server and Agent Registry APIs available on the deployed build. Confirm entitlement/version with your Vault administrator. See https://developer.hashicorp.com/vault/ai and https://developer.hashicorp.com/vault/tutorials/get-started/install-binary
- IBM Verify tenant with an API client allowed to read the agent; agent creation/status changes and notification webhook setup may require additional administrative privileges. See https://www.ibm.com/docs/en/security-verify?topic=access-creating-api-clients
- Docker Engine/Compose, Python 3, `jq`, OpenSSL, `envsubst` (from `gettext`), `curl`, and ngrok. Node.js is optional for unit tests. See [official links](OFFICIAL_LINKS.md).

For macOS with Homebrew:

```bash
brew install jq openssl@3 gettext ngrok
export PATH="$(brew --prefix openssl@3)/bin:$(brew --prefix gettext)/bin:$PATH"
python3 --version
jq --version
openssl version
envsubst --version
docker --version
docker info
docker compose version
docker context ls
```

If Docker Desktop is installed but stopped, use `open -a Docker`. Do not switch Docker contexts unless necessary. Existing downloaded Antenna 26.03.0 images may be reused; there is no need to delete them for a fresh container deployment.

## 3. Start and check Vault

Install Vault Enterprise, obtain your licensed `vault.hclic`, and add the Vault executable directory to `PATH`. From Terminal 1, **only if no existing Vault server is running**:

```bash
cd "/path/to/vault-enterprise-directory"
export VAULT_LICENSE_PATH="$PWD/vault.hclic"
./vault server -dev -dev-root-token-id=root -dev-listen-address=0.0.0.0:8200
```

**Local isolated lab only.** Dev mode uses `inmem` storage and a root token; data is lost on process restart. The Enterprise `inmem` warning is expected for this disposable example but is not appropriate for a persistent Enterprise deployment. Never expose Vault port 8200 publicly. Use persistent Raft/Consul storage, real TLS and scoped credentials for non-lab use.

If port 8200 is already occupied, **do not start a second server**. Inspect it with:

```bash
lsof -nP -iTCP:8200 -sTCP:LISTEN
```

Confirm you are using the intended Vault instance before stopping anything. In Terminal 2, from `lab/`:

```bash
export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="<your-lab-Vault-token>"
export VAULT_NAMESPACE=""  # root namespace
vault status
curl --fail-with-body -sS "$VAULT_ADDR/v1/sys/health" | jq '{initialized,sealed,version}'
```

Expected: `initialized=true`, `sealed=false`. `vault namespace list` may say `No namespaces found`: that means no child namespaces were listed, and does **not** invalidate the root namespace.

## 4. Fill in the shared environment file

```bash
nano scripts/00_env.sh
chmod 600 scripts/00_env.sh
source scripts/00_env.sh
```

Fill `VERIFY_TENANT_HOST` (hostname only), `VERIFY_CLIENT_ID`, `VERIFY_CLIENT_SECRET`, `VAULT_TOKEN`, and later `NGROK_URL`, `VAULT_CONFIG_ID` and `VAULT_MOUNT_ACCESSOR`. Do not paste credentials into documentation or version control. The sample is intentionally filled with placeholders, including the token; for disposable dev Vault the token may be `root` only when the server was started with the explicit `-dev-root-token-id=root` shown above.

`VAULT_ADDR_HOST="http://127.0.0.1:8200"` is used on your Mac; `VAULT_ADDR_FROM_ANTENNA="http://host.docker.internal:8200"` is the Docker receiver's route to host Vault. `VAULT_NAMESPACE=""` targets the root namespace. `VAULT_OAUTH_PROFILE="verify"` is the single profile used throughout. `SUBJECT_FORMAT="opaque"` is the Antenna 26.03.0 compatibility setting for this recipe; do not set `scim` unless separately verified on the actual runtime.

Editing the file does not load it into your shell: run `source scripts/00_env.sh` from `lab/` or `source ./00_env.sh` from `lab/scripts/`. A new terminal needs to source the file again.

**Avoid stale configuration:** if you use dev-mode Vault, complete Steps 5–6 before replacing `VAULT_CONFIG_ID` in the file. Restarting Vault resets its in-memory profile and changes the ID. Never reuse a stale accessor.

## 5. Obtain IBM Verify metadata and test API credentials

From `lab/`, after sourcing the file:

```bash
export TENANT="https://$VERIFY_TENANT_HOST"
curl --fail-with-body -sS "$TENANT/oauth2/.well-known/openid-configuration" -o verify-metadata.json
jq -e '.issuer and .jwks_uri and .token_endpoint' verify-metadata.json
export VERIFY_ISSUER="$(jq -er '.issuer' verify-metadata.json)"
export VERIFY_JWKS_URI="$(jq -er '.jwks_uri' verify-metadata.json)"
TOKEN_ENDPOINT="$(jq -er '.token_endpoint' verify-metadata.json)"
curl --fail-with-body -sS "$TOKEN_ENDPOINT" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode grant_type=client_credentials \
  --data-urlencode "client_id=$VERIFY_CLIENT_ID" \
  --data-urlencode "client_secret=$VERIFY_CLIENT_SECRET" -o admin-token.json
export ADMIN_ACCESS_TOKEN="$(jq -er '.access_token | select(type=="string" and length>0)' admin-token.json)"
```

Check the Verify agent API endpoint for your tenant; do not assume a token response implies read permission to `/v1.0/Agents`. Restrict local token-response files and avoid printing tokens.

## 6. Activate the OAuth resource server and create/reuse `verify` profile

```bash
curl --fail-with-body -sS -X POST \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/sys/activation-flags/oauth-resource-server/activate"
```

Activation **does not create a profile**. The initial profile GET can correctly return HTTP 404. Never parse the error JSON as a successful profile. A `LIST` request showing `{"errors":[]}` is not evidence that a `verify` profile exists.

Check for the existing profile without overwriting any working profile file:

```bash
export VAULT_OAUTH_PROFILE="verify"
HTTP_CODE="$(curl -sS -o verify-profile-current.json -w '%{http_code}' \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/sys/config/oauth-resource-server/$VAULT_OAUTH_PROFILE")"
echo "Profile GET HTTP status: $HTTP_CODE"
```

If the status is `200`, verify the `issuer_id` equals `$VERIFY_ISSUER` and proceed to the read-back block. If `404`, create this *same* `verify` profile. Any other status is an error that must be investigated first:

```bash
# Run ONLY when the preceding GET returned HTTP 404.
jq -n --arg issuer "$VERIFY_ISSUER" --arg jwks "$VERIFY_JWKS_URI" \
  '{issuer_id:$issuer,use_jwks:true,jwks_uri:$jwks,user_claim:"sub", \
    supported_algorithms:["RS256"],jwt_type:"access_token", \
    optional_authorization_details:false,enabled:true}' > verify-oauth.json
curl --fail-with-body -sS -X POST \
  -H "X-Vault-Token: $VAULT_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @verify-oauth.json \
  "$VAULT_ADDR/v1/sys/config/oauth-resource-server/verify"
```

Vault may reject a second profile that uses the same issuer with `duplicate issuer_id ... found in profile ...`. In that case, locate and reuse the existing correct profile; don't create a second profile named `course-verify` or delete the working one.

Always read back after creating/reusing:

```bash
curl --fail-with-body -sS -H "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/sys/config/oauth-resource-server/verify" -o verify-profile-current.json
jq -e --arg issuer "$VERIFY_ISSUER" \
  '.data | select(.profile_name=="verify" and .issuer_id==$issuer and .enabled==true and .user_claim=="sub")' \
  verify-profile-current.json
export VAULT_CONFIG_ID="$(jq -er '.data.config_id | select(type=="string" and length>0)' verify-profile-current.json)"
export VAULT_MOUNT_ACCESSOR="oauth-resource-server_root_${VAULT_CONFIG_ID}"
printf 'OAuth profile: %s\nAccessor: %s\n' "$VAULT_OAUTH_PROFILE" "$VAULT_MOUNT_ACCESSOR"
```

The accessor format assumes the root namespace. `config_id` comes from the **live** profile, not from a previous run. Alias creation during the end-to-end test confirms the accessor is accepted by Vault. Set `VAULT_CONFIG_ID` in `scripts/00_env.sh`, then source the file again; check that it yields the same accessor as above.

## 7. Create the agent ceiling policy

The ceiling policy limits an agent's maximum access at runtime; it **does not grant the Antenna receiver permission to provision identities**. Choose an example secret path and ceiling policy name that suit your deployment. This lab uses `verify-agent-ceiling` and the illustrative KV v2 path below; a real secret need not exist just to create the policy.

```bash
cat > ceiling.hcl <<'POLICY'
path "secret-v2/data/verify-agent/example" {
  capabilities = ["read"]
}
POLICY
jq -n --rawfile policy ceiling.hcl '{policy:$policy}' > ceiling.json
curl --fail-with-body -sS -X PUT \
  -H "X-Vault-Token: $VAULT_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @ceiling.json \
  "$VAULT_ADDR/v1/sys/policies/acl/$VAULT_POLICY"
vault policy read "$VAULT_POLICY"
```

Expected: `vault policy read` prints the HCL policy. If it says `Error reading policy named :`, your `VAULT_POLICY` variable is empty: source `scripts/00_env.sh` from `lab/` and retry. For an existing lab that already uses a different ceiling policy, set `VAULT_POLICY` to that existing name consistently in the env file instead of creating a second policy.

## 8. Validate the Vault provisioning credential

The Antenna receiver needs a Vault **provisioning token** to create/update identity entities, identity aliases and Agent Registry registrations. This is different from the agent ceiling policy. A lab root token may work, but production installations must use a least-privilege identity with suitable create/read/update/delete capabilities. See https://developer.hashicorp.com/vault/docs/concepts/policies and https://developer.hashicorp.com/vault/ai/iam/reference/agent-reg-summary.

```bash
vault token lookup -format=json | jq '.data | {display_name,policies,ttl,renewable,type}'
vault token capabilities identity/entity
vault token capabilities identity/entity-alias
vault token capabilities identity/entity/name/test-agent
vault token capabilities identity/entity/id/test-id
vault token capabilities agent-registry/register
vault token capabilities agent-registry/registration/entity-id/test-id
vault token capabilities agent-registry/registration/id/test-id
```

These commands check policy capabilities but do not create objects or prove that the Agent Registry API works. The successful lifecycle test supplies final proof. `VAULT_ADDR_FROM_ANTENNA` must be reachable from the receiver container, not merely from the host.

## 9. Preparation checks

```bash
source scripts/00_env.sh
printf 'Vault address: %s\nVault policy: %s\nOAuth profile: %s\nMount accessor: %s\nSubject format: %s\n' \
  "$VAULT_ADDR" "$VAULT_POLICY" "$VAULT_OAUTH_PROFILE" "$VAULT_MOUNT_ACCESSOR" "$SUBJECT_FORMAT"
vault policy read "$VAULT_POLICY"
curl --fail-with-body -sS "$VAULT_ADDR/v1/sys/health" | jq '{initialized,sealed,version}'
```

All named values should be populated; the subject format should be `opaque` for this Antenna lab. Do not print the Vault token or Verify client secret. Only proceed when Vault health, OAuth profile retrieval and policy read succeed.

**Continue to:** [Step 1 — Configure the transmitter](../transmitter/README.md).
