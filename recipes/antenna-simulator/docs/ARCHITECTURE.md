# Antenna Simulator - Architecture & Project Guide

This document provides a breakdown of the folder structure, component hierarchy, event schemas, and integration points for the **Antenna Simulator** repository.

---

## 📁 Repository Structure

```
antenna-simulator/
├── .bob/                       # Bob IDE context and prompt rules
│   └── rules/
│       └── antenna-simulator-context.md
├── docs/                       # Project documentation
│   └── ARCHITECTURE.md
├── src/
│   ├── api/                    # API client and payload generators
│   │   ├── payload.js          # Event formatting & payload builder
│   │   ├── ssfPreview.js       # SSF JWT token preview generator
│   │   └── transmitter.js      # Antenna Transmitter REST client
│   ├── components/             # React UI components
│   │   ├── EventStream/        # Live event stream feed
│   │   ├── Log/                # Log stream & console viewer
│   │   ├── PayloadPreview/     # SSF JSON/JWT payload inspector
│   │   ├── Pipeline/           # Transmitter data pipeline visualizer
│   │   ├── Simulator/          # Event trigger & parameter controls
│   │   └── TopBar/             # Header, status, and theme controls
│   ├── context/
│   │   └── AppContext.jsx      # Global React state management
│   ├── App.jsx                 # Main application layout & composition
│   ├── App.module.css          # Root layout styles
│   ├── config.js               # Application runtime configuration
│   ├── index.css               # Global theme & typography styles
│   ├── main.jsx                # React DOM entry point
│   └── test-setup.js           # Vitest / Jest-DOM test configuration
├── index.html                  # HTML entry point
├── package.json                # Project dependencies and npm scripts
└── vite.config.js              # Vite server & proxy configuration
```

---

## 🧩 Component Breakdown

### 1. `Simulator` (`src/components/Simulator/`)
- The main control center for dispatching security events.
- Allows configuring subject parameters (User ID, IP Address, Device ID, Confidence Score, Geo Coordinates, etc.).
- Triggers API calls to emit events to the Antenna Transmitter.

### 2. `Pipeline` (`src/components/Pipeline/`)
- Visualizes the end-to-end data pipeline:
  - **Inbound Event / Source** $\rightarrow$ **Antenna Transmitter Core** $\rightarrow$ **Datastore / Kafka** $\rightarrow$ **Receiver / Target**.
- Highlights active data flow when events are simulated.

### 3. `PayloadPreview` (`src/components/PayloadPreview/`)
- Renders formatted JSON / SSF SET (Security Event Token) specifications.
- Allows real-time inspection of CAEP claims and subject representations before dispatching.

### 4. `EventStream` (`src/components/EventStream/`)
- Displays a real-time list of generated and received events.
- Provides search, filtering by event type, and detailed payload view on click.

### 5. `Log` (`src/components/Log/`)
- Displays the live in-app execution console (pipeline trace entries for each simulated event).

### 6. `AppContext` (`src/context/AppContext.jsx`)
- Centralized React Context managing:
  - Active event selections and payload state.
  - Live log entries and event history.
  - Transmitter connectivity status.

---

## 🛡️ Supported SSF / CAEP Event Types

| Event Type | CAEP / SSF URI | Purpose |
|---|---|---|
| **Credential Compromised** | `https://schemas.openid.net/secevent/caep/event-type/credential-change` | Simulates leaked, stolen, or compromised user credentials. |
| **Anomalous Access** | `https://schemas.openid.net/secevent/caep/event-type/session-revoked` | Simulates suspicious login attempts or unusual access patterns. |
| **Geo-Anomaly** | `https://schemas.openid.net/secevent/caep/event-type/risk-level-change` | Simulates impossible travel or unexpected geographical locations. |
| **Unregistered Agent** | `https://schemas.openid.net/secevent/ssf/event-type/device-compliance-change` | Simulates access from unmanaged or unauthorized devices/agents. |
| **VIP Events** | Custom / CAEP extension | Simulates high-privilege account and VIP security incidents. |

---

## 🔌 API & Integration Layer

- **`src/api/transmitter.js`**: Communicates with the Antenna Transmitter REST endpoints (`/sources/...`).
- **`src/api/payload.js`**: Constructs standards-compliant SSF event subjects (Account, IP, Device) and event objects.
- **`src/api/ssfPreview.js`**: Builds preview tokens matching OpenID Shared Signals and Events (SSF) specification.
