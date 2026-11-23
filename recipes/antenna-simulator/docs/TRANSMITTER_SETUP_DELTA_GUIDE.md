# Transmitter Setup & Delta Guide: Threat Detection & NHI Playbooks

This guide details the **delta changes** required in the `verify-antenna-recipes` repository to enable Non-Human Identity (NHI) / AI Agent governance and VIP threat detection flows, including exposing your local transmitter via **ngrok** for external IBM Verify integration.

The instructions below assume a container runtime deployment but similar changes can be made for Kubernetes as well.

---

## 1. Prerequisites: Base Transmitter Setup

Before applying these delta changes, follow the standard local datastore and VIP transmitter setup steps as documented in the official recipe:

👉 **[IBM Verify Antenna VIP Transmitter Setup Guide](../../vip/transmitter/README.md)**

Once you have completed the base setup steps (certificates generation, datastore running, and base transmitter initialized), apply the specific edits below to get the Threat Detection & NHI demo running.

---

## 2. Delta Overview

Compared to the base local VIP transmitter recipe, the following changes are introduced:

| Component | Base Local Setup | Updated Flow (Delta) |
| :--- | :--- | :--- |
| **Event Types** | Only `risk-level-change` and `credential-compromise` | Added custom NHI event types (`urn:ibm:agent:unregistered_agent`, `urn:ibm:agent:anomalous_access`, `urn:ibm:agent:invalid_owner`). |
| **Event Mapper** | Basic User VIP mapping | Multi-event mapper (`vip_event_mapper.js`) supporting Complex Subjects (`user` + `agent`) and specialized AI Agent threat events. |
| **Ingester Source** | Manual entry | Added `vip` HTTP push source mapped to `@js/vip_event_mapper.js`. |
| **Transmitter Logging** | Container stdout only | Mounted `./logs:/logs` and added container entrypoint to pipe logs directly into `transmitter.log`. |
| **Emission Test Scripts** | Base VIP scripts | Standalone event emission scripts for each threat/playbook scenario with configurable `USER_ID`, `AGENT_ID`, and `TRANSMITTER_URL`. |

---

## 3. Required Delta Edits

All configuration templates are provided in the `/transmitter-configs` folder of this project.

### 3.1. Replace `vip_event_mapper.js`

Replace the existing `vip_event_mapper.js` with the updated version from `transmitter-configs/vip_event_mapper.js` and place it at **both** of the following locations in your `verify-antenna-recipes` repo:

1. `recipes/vip/transmitter/configs/js/vip_event_mapper.js`
2. `deploying/transmitter/container-runtime/configs/js/vip_event_mapper.js`

```bash
# Example copy commands (from the repository root):
cp recipes/antenna-simulator/transmitter-configs/vip_event_mapper.js \
   recipes/vip/transmitter/configs/js/vip_event_mapper.js

cp recipes/antenna-simulator/transmitter-configs/vip_event_mapper.js \
   deploying/transmitter/container-runtime/configs/js/vip_event_mapper.js
```

> **What changed in `vip_event_mapper.js`:**
> - Generates both standard RISC/CAEP events and NHI custom events (`urn:ibm:agent:unregistered_agent`, `urn:ibm:agent:anomalous_access`, `urn:ibm:agent:invalid_owner`).
> - Supports **Complex Subjects** containing both the User (opaque IBM Verify `user_id`) and Non-Human Identity (`agent_id` / `agent_name`).

---

### 3.2. Update `transmitter.yml`

Update `base_url` and `issuer` in `transmitter-configs/transmitter.yml` with your Ngrok hostname or `https://localhost:9044` if only testing locally before creating the stream. Note that a publicly accessible hostname must be used for Verify SaaS to reach this transmitter.

Copy or merge the configuration from `transmitter-configs/transmitter.yml` into your transmitter runtime configuration file:
`deploying/transmitter/container-runtime/configs/transmitter.yml`

```bash
# Example copy command (from the repository root):
cp recipes/antenna-simulator/transmitter-configs/transmitter.yml \
   deploying/transmitter/container-runtime/configs/transmitter.yml
```

> **Key Additions in `transmitter.yml`:**
>
> 1. **Custom NHI Event Types** under `transmitter.event_types`:
>    ```yaml
>    event_types:
>      - "https://schemas.openid.net/secevent/ssf/event-type/verification"
>      - "https://schemas.openid.net/secevent/caep/event-type/session-revoked"
>      - "https://schemas.openid.net/secevent/caep/event-type/device-compliance-change"
>      - "https://schemas.openid.net/secevent/caep/event-type/risk-level-change"
>      - "https://schemas.openid.net/secevent/risc/event-type/credential-compromise"
>      - "https://iam.ibm.com/secevent/ssf/event-type/application"
>      - "urn:ibm:agent:unregistered_agent"
>      - "urn:ibm:agent:anomalous_access"
>      - "urn:ibm:agent:invalid_owner"
>    ```
> 2. **VIP Ingester Source** under `transmitter.ingester.sources`:
>    ```yaml
>    - id: vip
>      type: http_push
>      transform_rule:
>        type: javascript
>        content: "@js/vip_event_mapper.js"
>    ```
> 3. **Public URL / Ngrok base_url & issuer**: Set `base_url` and `issuer` to your Ngrok HTTPS tunnel URL or `https://localhost:9044` for local testing.

---

### 3.3. Update `docker-compose.yml` for File Logging (Recommended)

> **Note:** Only relevent to container runtime deployments

In `deploying/transmitter/container-runtime/docker-compose.yml`, mount `./logs` and set the entrypoint so logs are piped to `transmitter.log`:

```yaml
services:
  antenna-transmitter:
    image: icr.io/ibm-verify/ibm-verify-antenna-transmitter:26.09.0
    container_name: antenna-transmitter
    restart: always
    ports:
      - "9044:9044"
    volumes:
      - ./configs:/var/antenna/config
      - ./db:/db
      - ./logs:/logs
    entrypoint: >
      sh -c "exec /app/antenna 2>&1 | tee /logs/transmitter.log"
    env_file: "./.env"

networks:
  default:
    name: antenna-network
    external: true
```

*(A ready-to-use template is also available at `transmitter-configs/docker-compose.transmitter.yml`)*

---

### 3.4. Restart Transmitter

Apply the updated configuration by restarting the transmitter container:

```bash
cd deploying/transmitter/container-runtime
docker compose down && docker compose up -d
```

If using Kubernetes, update the `transmitter-config` ConfigMap, and then restart the StatefulSet:

```bash
# Restart the StatefulSet
kubectl rollout restart statefulset/antenna-transmitter -n <namespace>

# Wait for the rollout to complete
kubectl rollout status statefulset/antenna-transmitter -n <namespace>
```

---

## 4. Public Exposure via Ngrok (Localhost Tunnel)

> **Note:** Only relevent to container runtime deployments

When integrating with IBM Verify SaaS or external SSF receivers, the SSF Transmitter endpoint (`/.well-known/ssf-configuration`) must be reachable via HTTPS on the internet. Tunnel port `9044` with ngrok:

```bash
ngrok http https://localhost:9044 --host-header="localhost:9044"
```

Copy your assigned public HTTPS URL (e.g., `https://steadfast-thumb-garment.ngrok-free.dev`) and ensure it matches the `base_url` and `issuer` in `transmitter.yml`.

---

## 5. Connecting Antenna Simulator UI to Transmitter

By default, the Antenna Simulator connects to `https://localhost:9044`.

### Option A: Localhost (Default)
In `recipes/antenna-simulator/vite.config.js`:
```javascript
server: {
  port: 9045,
  proxy: {
    '/sources': {
      target: 'https://localhost:9044',
      changeOrigin: true,
      secure: false, // Bypasses self-signed cert checks
    },
  }
}
```

### Option B: Ngrok / Remote URL
Update `recipes/antenna-simulator/vite.config.js` or set `VITE_PROXY_URL`:
```javascript
server: {
  port: 9045,
  proxy: {
    '/sources': {
      target: 'https://<your-ngrok-domain>.ngrok-free.dev',
      changeOrigin: true,
      secure: false,
    },
  }
}
```

---

## 6. Verification & Test Event Scripts

### 6.1. Verify SSF Metadata Endpoints
```bash
# Localhost
curl -k -s https://localhost:9044/.well-known/ssf-configuration | jq .

# Ngrok Public URL
curl -s https://<your-ngrok-domain>.ngrok-free.dev/.well-known/ssf-configuration | jq .
```

You can also verify these in a browser.

### 6.2. Emitting Test Events via CLI
Run from `recipes/antenna-simulator/transmitter-configs`:

```bash
# 1. Credential Compromised (RISC credential-compromise)
./emit_credential_compromised_event.sh https://localhost:9044 <USER_ID> <AGENT_ID>

# 2. Geo-Anomaly (CAEP risk-level-change)
./emit_geo_anomaly_event.sh https://localhost:9044 <USER_ID> <AGENT_ID>

# 3. Unregistered / Shadow Agent (urn:ibm:agent:unregistered_agent)
./emit_agent_created_event.sh https://localhost:9044 <AGENT_NAME> <EXT_AGENT_ID> <USER_ID>

# 4. Anomalous Access (urn:ibm:agent:anomalous_access)
./emit_anomalous_access_event.sh https://localhost:9044 <AGENT_ID> <USER_ID> <ASSET_TYPE> <ASSET_ID> <IP_ADDRESS>

# 5. Invalid Owner (urn:ibm:agent:invalid_owner)
./emit_invalid_owner_event.sh https://localhost:9044 <AGENT_ID> <PREV_OWNER_ID> <EXT_AGENT_ID>
```

### 6.3. Inspect Transmitter Logs
```bash
tail -f deploying/transmitter/container-runtime/logs/transmitter.log
```
