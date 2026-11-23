# Antenna Simulator

A modern React and Vite-based interactive simulation and visualization dashboard for **IBM Verify Antenna**.

This UI allows developers and security engineers to simulate Shared Signals and Events (SSF / CAEP / RISC / NHI), inspect data flow through the Antenna Transmitter pipeline, preview SSF Security Event Tokens (SETs), and monitor real-time event streams.

---

## 🚀 Features

- **Security & NHI Event Simulator**: Generate and trigger standard SSF/CAEP security events and Non-Human Identity (AI Agent) governance events (Credential Compromised, Anomalous Access, Geo-Anomaly, Unregistered Agent, Agent Invalid Owner).
- **Pipeline Visualizer**: Real-time visual representation of data movement across Transmitter sources, datastores (Kafka), and event receivers.
- **SSF Payload Preview**: Live preview and validation of generated JWT/SSF security event tokens before emitting.
- **Live Event Stream**: Real-time feed of ingested and dispatched events.
- **Integrated Logging**: Log stream viewer for tracking transmitter and simulation activities.

---

## 📦 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **IBM Verify Antenna Transmitter**: Running locally (`https://localhost:9044`) or exposed via Ngrok.

---

## 🔧 Transmitter Backend Setup (Delta Guide)

Before launching the Antenna Simulator UI, configure and start the IBM Verify Antenna Transmitter backend with the required NHI event types and VIP event mapper:

👉 [**Transmitter Setup & Delta Guide (Threat Detection & NHI)**](docs/TRANSMITTER_SETUP_DELTA_GUIDE.md)

### Key Setup Steps:
1. **Base Transmitter Setup**: Follow the official [IBM Verify Antenna VIP Transmitter Setup Guide](../vip/transmitter/README.md).
2. **Apply Delta Configurations**:
   - Replace `vip_event_mapper.js` in your recipes directory with [`transmitter-configs/vip_event_mapper.js`](transmitter-configs/vip_event_mapper.js).
   - Update `transmitter.yml` using the template at [`transmitter-configs/transmitter.yml`](transmitter-configs/transmitter.yml) to add the custom NHI `event_types` and `vip` ingester source.
   - Update `docker-compose.yml` to enable file logging to `./logs/transmitter.log`.
3. **Restart Transmitter**: `docker compose down && docker compose up -d`.
4. **Expose via Ngrok** (if integrating with external SaaS / IBM Verify): `ngrok http https://localhost:9044 --host-header="localhost:9044"`.

---

## 🔔 IBM Verify SaaS Antenna Receiver Configuration

Before the Antenna Receiver in IBM Verify SaaS can act on NHI events emitted by this simulator, the custom event types and their associated playbooks must be imported and configured in the Verify SaaS tenant.

👉 [**Verify SaaS Antenna Receiver Setup Guide**](docs/VERIFY_SAAS_RECEIVER_SETUP.md)

### Quick Reference

| Scenario | Event URN | Playbook(s) |
|---|---|---|
| Shadow Agent Detected | `urn:ibm:agent:unregistered_agent` | `agentcreation` → `assign_ownership` |
| Anomalous Asset Access | `urn:ibm:agent:anomalous_access` | `suspend_agentidentity` |
| Agent with Invalid Owner | `urn:ibm:agent:invalid_owner` | `assign_ownership` |
| Credential Compromised | `https://schemas.openid.net/secevent/risc/event-type/credential-compromise` | `session_revoked` |
| Geo-Anomaly Detected | `https://schemas.openid.net/secevent/caep/event-type/risk-level-change` | `suspend_agentidentity` |

> All custom event types and playbooks must be configured in the Antenna Receiver **before** emitting events. See the [full setup guide](docs/VERIFY_SAAS_RECEIVER_SETUP.md) for schemas, playbook task details, and file locations.

---

## 🛠️ Getting Started (UI Setup)

Once your Antenna Transmitter backend is running:

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

The application will start at:
👉 **[http://localhost:9045](http://localhost:9045)**

---

## ⚙️ Configuration & Network Proxy

The development server includes a built-in proxy in [`vite.config.js`](vite.config.js) to avoid CORS issues:

- `/sources/*` $\rightarrow$ Proxied to Antenna Transmitter (`https://localhost:9044` by default, or your Ngrok URL) with SSL verification bypassed for self-signed certificates.

To point the UI to an Ngrok tunnel or remote URL, see [Connecting Antenna Simulator UI to Transmitter](docs/TRANSMITTER_SETUP_DELTA_GUIDE.md#5-connecting-antenna-simulator-ui-to-transmitter).

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite dev server with hot reload at port `9045` |
| `npm run build` | Compiles and optimizes assets into `dist/` |
| `npm run preview` | Locally previews the production build |
| `npm run test` | Runs unit test suite using Vitest in watch mode |
| `npm run test:run` | Runs unit test suite once |
| `npm run test:ui` | Opens interactive Vitest UI runner |

---

## 📖 Architecture & Components

For an in-depth breakdown of components, project structure, and supported event types, see [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).
