#!/usr/bin/env bash
# IBM Verify Agent Registry -> HashiCorp Vault Agent Registry sync lab.
# Edit this file, then run: source scripts/00_env.sh

export LAB_NAME="verify-vault-agent-registry"

# On Mac, localhost works for host-side curl calls to the containers.
export HOST_IP="localhost"

# Fill this after you start ngrok. Example: https://abc-123.ngrok-free.app
export NGROK_URL="CHANGEME_NGROK_HTTPS_URL"

# IBM Verify tenant and service client that can read Agent Registry data.
# Host only, no https:// prefix.
export VERIFY_TENANT_HOST="CHANGEME.verify.ibmcloudsecurity.com"
export VERIFY_CLIENT_ID="CHANGEME_VERIFY_CLIENT_ID"
export VERIFY_CLIENT_SECRET="CHANGEME_VERIFY_CLIENT_SECRET"
export VERIFY_AGENT_API_PATH="/v1.0/Agents"

# Vault access.
# VAULT_ADDR_HOST is used by scripts running on your Mac.
# VAULT_ADDR_FROM_ANTENNA is used inside Antenna receiver container.
export VAULT_ADDR_HOST="http://127.0.0.1:8200"
export VAULT_ADDR_FROM_ANTENNA="http://host.docker.internal:8200"
export VAULT_ADDR="$VAULT_ADDR_HOST"
export VAULT_TOKEN="CHANGEME_VAULT_PROVISIONING_TOKEN"
export VAULT_NAMESPACE=""  # Empty targets root namespace (no header)

# Agent ceiling policy: create the named policy in Vault before starting the receiver.
export VAULT_POLICY="verify-agent-ceiling"

# OAuth resource-server profile/identity alias accessor. Get config_id by reading the
# live Vault profile. These IDs change if an in-memory Vault is restarted.
export VAULT_OAUTH_PROFILE="verify"
export VAULT_CONFIG_ID="CHANGEME_VAULT_CONFIG_ID"
export VAULT_MOUNT_ACCESSOR="oauth-resource-server_root_${VAULT_CONFIG_ID}"

# HashiCorp docs currently show ceiling_policies. Some early builds used ceiling_policy_identifiers.
export VAULT_AGENT_REGISTRY_CEILING_FIELD="ceiling_policies"

export TX_PORT="9044"
export RX_PORT="9043"
export PATCH_EVENT="urn:ietf:params:scim:event:prov:patch:full"
export CREATE_EVENT="urn:ietf:params:scim:event:prov:create:full"

export TX_CONTAINER="${LAB_NAME}-transmitter"
export RX_CONTAINER="${LAB_NAME}-receiver"

# Use opaque for the Antenna 26.03.0 lab compatibility configuration.
# Subject format must agree with the stream/event handlers; record this choice.
# Set the SAME value in both handlers through this one environment file.
export SUBJECT_FORMAT="opaque"

# This file contains local secrets after you fill it in. chmod 600 and never commit it.
