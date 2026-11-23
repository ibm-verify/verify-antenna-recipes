import React, { useCallback, useState } from 'react'
import { AppProvider, useApp, Actions } from './context/AppContext.jsx'
import { DEFAULTS, EVENT_DEFINITIONS } from './config.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))
import TopBar         from './components/TopBar/TopBar.jsx'
import Pipeline       from './components/Pipeline/Pipeline.jsx'
import EventStream    from './components/EventStream/EventStream.jsx'
import Simulator      from './components/Simulator/Simulator.jsx'
import PayloadPreview from './components/PayloadPreview/PayloadPreview.jsx'
import Log            from './components/Log/Log.jsx'
import { buildPayload }    from './api/payload.js'
import { sendVipEvent }    from './api/transmitter.js'
import { buildSSFPreview } from './api/ssfPreview.js'
import styles from './App.module.css'

const DEFAULT_FIELDS = {
  userId:      DEFAULTS.userId,
  agentId:     DEFAULTS.agentId,
  displayName: DEFAULTS.displayName,
  description: DEFAULTS.description,
  externalId:  DEFAULTS.externalId,
  tags:        DEFAULTS.tags,
  status:      DEFAULTS.status,
}

function AppInner() {
  const { state, dispatch, log, clearLog, setNodeActive, animatePacket } = useApp()
  const { logEntries, pipelineStatus, packetActive, actionCount, isRunning, streamRecords } = state

  const initDef   = EVENT_DEFINITIONS[0]
  const initFields = { ...DEFAULT_FIELDS, issueType: initDef.id }

  // Live payload preview — updated on every keystroke from Simulator
  const [previewPayload, setPreviewPayload] = useState(
    () => buildPayload(initDef.kind, initFields)
  )
  const [sentStatus,    setSentStatus]    = useState(null)
  const [currentKind,   setCurrentKind]   = useState(initDef.kind)

  // Called by Simulator on every input change — keeps preview in sync
  const handleInputChange = useCallback((kind, fields, eventId) => {
    const allFields = { ...fields, issueType: eventId }
    setPreviewPayload(buildPayload(kind, allFields))
    setCurrentKind(kind)
    setSentStatus(null)
  }, [])

  const handleSend = useCallback(async (kind, fields, eventId) => {
    if (isRunning) return
    dispatch({ type: Actions.SET_RUNNING, payload: true })
    setSentStatus(null)
    setCurrentKind(kind)

    const allFields = { ...fields, issueType: eventId }
    const payload   = buildPayload(kind, allFields)
    setPreviewPayload(payload)

    const now = new Date()
    const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':')

    const def = EVENT_DEFINITIONS.find(d => d.id === eventId) || EVENT_DEFINITIONS[0]

    // ── Step 1: log the detected / provisioning event ──────────────────────
    if (kind === 'credential-compromised') {
      log('threat', `══════════ <span class="red">CREDENTIAL COMPROMISE DETECTED BY THREAT DETECTOR</span> ══════════`)
      log('warn',   `Owner's API key leaked — user <span class="hi">${fields.userId || '(none)'}</span> · Risk: <span class="red">Critical</span>`)
      log('info',   `Direct user token active in agentic context. Forwarding to Antenna Transmitter.`)
    } else if (kind === 'vip') {
      log('threat', `══════════ <span class="red">ROGUE AGENT DETECTED BY THREAT DETECTOR</span> ══════════`)
      log('warn',   `Anomalous token activity — user <span class="hi">${fields.userId || '(none)'}</span> · Risk: <span class="red">Critical</span>`)
      log('info',   `Token linked to agent <span class="cyan">${fields.agentId || '(none)'}</span>. Forwarding to Antenna Transmitter.`)
    } else if (kind === 'unregistered-agent') {
      log('info',  `══════ <span class="cyan">UNREGISTERED AGENT DETECTED</span> ══════`)
      log('info',  `Agent: <span class="hi">${fields.displayName || 'Unnamed'}</span> · External ID: <span class="cyan">${fields.externalId || '—'}</span>`)
      log('info',  `Owner: <span class="hi">${fields.userId || '—'}</span>. Forwarding to Antenna Transmitter.`)
    } else if (kind === 'anomalous-access') {
      log('warn',  `══════ <span class="red">ANOMALOUS AGENT ACCESS DETECTED</span> ══════`)
      log('warn',  `Agent: <span class="cyan">${fields.agentId || '(none)'}</span> · Asset: <span class="hi">${fields.assetType || '—'}/${fields.assetId || '—'}</span>`)
      log('info',  `User: <span class="hi">${fields.userId || '—'}</span> · IP: <span class="cyan">${fields.ipAddress || '—'}</span>. Forwarding to Antenna Transmitter.`)
    } else if (kind === 'invalid-owner') {
      log('warn',  `══════ <span class="yellow">AGENT WITH INVALID OWNER DETECTED</span> ══════`)
      log('warn',  `Agent: <span class="cyan">${fields.agentId || '(none)'}</span> · Previous owner: <span class="hi">${fields.userId || '(none)'}</span>`)
      log('info',  `Forwarding to Antenna Transmitter.`)
    }

    // Stage 1: VIP node lights up → packet travels to Transmitter
    setNodeActive('vip', true)
    await sleep(600)
    await animatePacket('pkt1')
    setNodeActive('tx', true)
    await sleep(400)

    const result = await sendVipEvent(payload)
    setSentStatus({ ...result, ts })

    // ── Step 2: forward to Antenna ─────────────────────────────────────────
    const showPipeline = async (simulated = false) => {
      const prefix = simulated ? '[demo] ' : ''
      if (kind === 'credential-compromised' || kind === 'vip') {
        log('ok',   `${prefix}Security event accepted by Antenna Transmitter (<span class="green">HTTP ${result.status || '—'}</span>)`)
        await sleep(800)
        log('info', `Transforming to SSF SET and forwarding to IBM Verify Antenna...`)
      } else {
        log('ok',   `${prefix}Agent identity event accepted by Antenna Transmitter`)
        await sleep(800)
        log('info', `Encapsulating as SSF SET (RFC 8417) and forwarding to IBM Verify Antenna...`)
      }

      const preview = buildSSFPreview(kind, fields.userId, fields.agentId, payload)
      dispatch({ type: Actions.ADD_STREAM_RECORD, payload: preview })
      await sleep(800)

      await animatePacket('pkt2')
      setNodeActive('rx', true)
      await sleep(600)
      log('ok',   `${prefix}IBM Verify Antenna received and validated the SSF SET`)
      await sleep(600)

      if (kind === 'anomalous-access') {
        log('info', `Subject: <span class="cyan">complex { agent: ${fields.agentId || '—'}, user: ${fields.userId || '—'} }</span>`)
      } else if (kind === 'unregistered-agent') {
        log('info', `Subject: <span class="cyan">scim { uri: /Agents/am-agent-... }</span>`)
      } else if (kind === 'credential-compromised') {
        log('info', `Subject: <span class="cyan">user { id: ${fields.userId || '—'} }</span>`)
      } else if (kind === 'vip') {
        log('info', `Subject: <span class="cyan">complex { user: ${fields.userId || '—'}, agent: ${fields.agentId || '—'} }</span>`)
      } else {
        log('info', `Subject: <span class="cyan">opaque { id: ${fields.agentId || '—'} }</span>`)
      }
      await sleep(1000)

      await animatePacket('pkt3')
      setNodeActive('action', true)
      await sleep(600)

      if (kind === 'credential-compromised') {
        log('threat', `🔓 <span class="red">PLAYBOOK TRIGGERED: REVOKE USER SESSIONS</span>`)
        await sleep(500)
        log('info',   `  User: <span class="hi">${fields.userId || '(none)'}</span>`)
        await sleep(500)
        log('ok',     `  Action Executed: <span class="red">User sessions REVOKED</span> in IBM Verify`)
      } else if (kind === 'vip') {
        log('threat', `⚡ <span class="red">PLAYBOOK TRIGGERED: SUSPEND AGENT</span>`)
        await sleep(500)
        log('info',   `  User: <span class="hi">${fields.userId || '(none)'}</span> · Agent: <span class="cyan">${fields.agentId || '(none)'}</span>`)
        await sleep(500)
        log('ok',     `  Action Executed: <span class="red">Agent successfully SUSPENDED</span> in IBM Verify`)
      } else if (kind === 'unregistered-agent') {
        log('ok',  `⚡ <span class="cyan">PLAYBOOK TRIGGERED: ONBOARD AGENT</span>`)
        await sleep(500)
        log('ok',  `  Agent <span class="hi">${fields.displayName || '—'}</span> registered in IBM Verify`)
      } else if (kind === 'anomalous-access') {
        log('threat', `⚡ <span class="red">PLAYBOOK TRIGGERED: SUSPEND AGENT</span>`)
        await sleep(500)
        log('ok',     `  Agent <span class="cyan">${fields.agentId || '—'}</span> suspended — anomalous asset access`)
      } else if (kind === 'invalid-owner') {
        log('ok',  `⚡ <span class="yellow">PLAYBOOK TRIGGERED: ASSIGN AGENT OWNER</span>`)
        await sleep(500)
        log('ok',  `  Agent <span class="cyan">${fields.agentId || '—'}</span> assigned to new owner in IBM Verify`)
      }

      dispatch({ type: Actions.INCREMENT_COUNT })
    }

    if (result.ok) {
      await showPipeline(false)
    } else if (result.error) {
      log('warn', `Proxy unreachable (${result.error}) — simulating pipeline for demo:`)
      await sleep(800)
      await showPipeline(true)
    } else {
      log('warn', `Transmitter returned HTTP ${result.status}`)
    }

    dispatch({ type: Actions.SET_RUNNING, payload: false })
  }, [isRunning, dispatch, log, setNodeActive, animatePacket])

  return (
    <div className={styles.app}>
      <TopBar actionCount={actionCount} />

      <div className={styles.main}>
        {/* 1 ── Pipeline animation */}
        <Pipeline
          status={pipelineStatus}
          packets={packetActive}
          kind={currentKind}
        />

        {/* 2 ── Simulator + Live Payload Preview */}
        <div className={styles.controlRow}>
          <Simulator
            onSend={handleSend}
            onInputChange={handleInputChange}
            isRunning={isRunning}
          />
          <PayloadPreview payload={previewPayload} sentStatus={sentStatus} />
        </div>

        {/* 3 ── SSF Transformation Stream */}
        <EventStream records={streamRecords} />

        {/* 4 ── Execution Log */}
        <Log entries={logEntries} onClear={clearLog} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
