import React, { useState } from 'react'
import styles from './EventStream.module.css'

const KIND_LABEL = {
  'vip':               'Threat Detector Payload (sent)',
  'unregistered-agent': 'Unregistered Agent Event',
  'anomalous-access':   'Anomalous Access Event',
  'invalid-owner':      'Invalid Owner Event',
}

function JsonPanel({ label, labelColor, data }) {
  return (
    <div className={styles.panel}>
      <div className={`${styles.panelLabel} ${styles[labelColor]}`}>{label}</div>
      <pre className={styles.code}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}

function kindToColor(kind) {
  if (kind === 'unregistered-agent') return 'cyan'
  if (kind === 'invalid-owner')      return 'yellow'
  return 'red'
}

function getInputView(record) {
  const { input, kind } = record
  if (kind === 'vip') {
    return {
      issue_type:  input.issue_type,
      risk:        input.risk,
      issue_time:  input.issue_time,
      issue_keys:  input.issue_keys,
      message:     input.message,
    }
  }
  // Agent identity events — show all top-level keys except internal ones
  const { issue_id: _id, ...rest } = input
  return rest
}

function EventCard({ record }) {
  const { output, ts, kind } = record
  const [collapsed, setCollapsed] = useState(false)

  const inputView = getInputView(record)
  const ssfView   = output ? { sub_id: output.sub_id, events: output.events } : null

  const isVip  = kind === 'vip'
  const typeLabel = record.input?.issue_type || record.input?.event_type || kind
  const riskTag   = record.input?.risk

  const colorClass = kindToColor(kind)

  return (
    <div className={`${styles.card} ${styles[`card_${colorClass}`]}`} data-testid="event-card">
      <div className={styles.cardHeader} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.toggle}>{collapsed ? '▸' : '▾'}</span>
        <span className={`${styles.kindTag} ${styles[`kind_${colorClass}`]}`}>
          {kind === 'vip' ? 'THREAT' : kind === 'unregistered-agent' ? 'UNREGISTERED' : kind === 'anomalous-access' ? 'ANOMALOUS ACCESS' : 'INVALID OWNER'}
        </span>
        <span className={styles.issueType}>{typeLabel}</span>
        {riskTag && (
          <span className={riskTag === 'Critical' ? styles.critical : styles.high}>
            {riskTag}
          </span>
        )}
        <span className={styles.cardTs}>{ts}</span>
      </div>

      {!collapsed && (
        <div className={styles.cardBody}>
          <JsonPanel
            label={`⬇ ${KIND_LABEL[kind] || 'Input (sent)'}`}
            labelColor="labelIn"
            data={inputView}
          />
          <div className={styles.divider}>
            <span>transforms to ➔</span>
          </div>
          <JsonPanel label="⬆ SSF SET (output)" labelColor="labelOut" data={ssfView} />
        </div>
      )}
    </div>
  )
}

export default function EventStream({ records }) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.dot}></span>
        <span className={styles.title}>📡 SSF Transformation Stream</span>
        <span className={styles.hint}>Input Payload → SSF SET</span>
        {records.length > 0 && (
          <span className={styles.count}>
            {records.length} event{records.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className={styles.body}>
        {records.length === 0 ? (
          <div className={styles.empty}>
            ⏳ Send an event to see the input → SSF SET transformation here.
          </div>
        ) : (
          [...records].map(r => (
            <EventCard key={r.id} record={r} />
          ))
        )}
      </div>
    </section>
  )
}
