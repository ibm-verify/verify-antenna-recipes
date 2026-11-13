# Synchronize IBM Verify Agent Identity with HashiCorp Vault

## Objective

This recipe configures IBM Verify Antenna to synchronize the lifecycle of IBM Verify AI agents into HashiCorp Vault. When an agent is created, updated, suspended or reactivated in IBM Verify, the integration processes a management notification and updates the corresponding Vault identity entity, alias and Agent Registry registration.

## Architecture

```text
IBM Verify (agent management events)
    │ Notification webhook over HTTPS
    ▼
Antenna transmitter (HTTP push source, port 9044)
    │ Event transformation; SSF polling stream
    ▼
Antenna receiver (port 9043)
    │ Check current IBM Verify agent state
    ▼
HashiCorp Vault (identity entity + alias + Agent Registry)
```

The transmitter transforms agent management notifications into provisioning events. The receiver retrieves the current agent from IBM Verify and applies the corresponding Vault operation. The Docker example runs the transmitter and receiver locally and exposes **only the transmitter webhook endpoint** through an HTTPS tunnel.

## Prerequisites

- IBM Verify tenant with permissions to manage agent notification webhooks and an API client that can read agent details.
- HashiCorp Vault Enterprise environment licensed for the required OAuth resource-server and Agent Registry APIs; confirm feature availability for the installed version.
- Vault provisioning credential permitted to manage the required identity entities, aliases and agent registrations.
- Docker Engine with Compose, Python 3, `jq`, OpenSSL, `envsubst` and an HTTPS tunnel such as ngrok.
- A Verify agent with one supported OAuth client association carrying purpose `agent_id` for active-agent provisioning.

See [preparation and installation](docs/00_PREPARE.md) and [official installation and API references](docs/OFFICIAL_LINKS.md) for full URLs.

## Setup: follow these guides in order

| Step | Instructions | Completion check |
|---|---|---|
| **0. Prepare environment** | [Install tools; configure Vault and Verify](docs/00_PREPARE.md) | Vault is initialized, unsealed and supports the required APIs; Verify API access works |
| **1. Configure transmitter** | [Transmitter setup](transmitter/README.md) | Antenna transmitter starts; public endpoint receives Verify notifications |
| **2. Configure receiver** | [Vault receiver setup](vault-receiver/README.md) | Receiver starts, connects to Vault and subscribes to both event types |
| **3. Verify synchronization** | [End-to-end lifecycle test and troubleshooting](docs/03_TEST_AND_TROUBLESHOOT.md) | Agent create/update/suspend/reactivate reflected in Vault |

**Where to run commands:** After extracting the ZIP, open a terminal in `verify-antenna-recipes/recipes/verify-vault`. Follow Step 0 to enter the `lab/` directory. Unless a guide says otherwise, all Docker and shell-script commands are run from `lab/`. The local configuration values are in `lab/scripts/00_env.sh`.

## Synchronization behavior

| IBM Verify agent state or event | Vault result |
|---|---|
| Active agent with one eligible OAuth client | Create or update identity entity, alias and registration |
| Agent metadata modified | Update its existing Vault registration |
| Agent suspended or otherwise not active | Disable existing entity and remove registration; preserve alias |
| Agent reactivated | Re-enable the existing entity and restore registration |

The integration requires current, readable Verify agent state. It deliberately avoids changing Vault on an active agent when the required OAuth association purpose cannot be confirmed. See [receiver setup](vault-receiver/README.md) for the identity mapping and permissions.

## Deployment notes

For the local Docker demonstration, the Vault dev server, self-signed Antenna certificates and disposable credentials are intended for isolated testing only. Use scoped credentials, trusted certificates, restricted network access and persistent Vault storage in production. Confirm event subject-format compatibility with the Antenna release in use; the supplied Antenna 26.03.0 example uses `opaque` subject compatibility mode; use the standards-based `scim` setting only after validating it with the installed runtime.

For installation, product concepts and configuration API references, see [official documentation URLs](docs/OFFICIAL_LINKS.md).
