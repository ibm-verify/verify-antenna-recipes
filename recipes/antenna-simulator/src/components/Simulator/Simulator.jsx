import React, { useState, useCallback } from 'react'
import { DEFAULTS, EVENT_DEFINITIONS } from '../../config.js'
import styles from './Simulator.module.css'

const FIELD_META = {
  userId:      { label: 'User ID',            placeholder: '8120028SFS',                               hint: 'Opaque IBM Verify user ID (owner / previous owner)' },
  agentId:     { label: 'Agent ID',           placeholder: '01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b',       hint: 'Opaque UUID' },
  displayName: { label: 'Display Name',       placeholder: 'Trade Agent Alpha',                            hint: 'Human-readable agent name' },
  description: { label: 'Description',        placeholder: 'Trade Agent for Execution',                    hint: 'Short description' },
  externalId:  { label: 'External ID(s)',     placeholder: 'ext-id-001, ext-id-002',                      hint: 'Comma-separated external identifiers' },
  tags:        { label: 'Tags',               placeholder: 'langflow, trade-agent',                       hint: 'Comma-separated labels' },
  assetType:   { label: 'Asset Type',         placeholder: 'database',                                    hint: 'database | s3-bucket | api-endpoint | secrets-vault' },
  assetId:     { label: 'Asset ID',           placeholder: 'prod-db-01',                                  hint: 'Identifier of the accessed asset' },
  ipAddress:   { label: 'IP Address',         placeholder: '192.168.55.21',                               hint: 'Session / network context (optional)' },
}

export default function Simulator({ onSend, onInputChange, isRunning }) {
  const [selectedEventId, setSelectedEventId] = useState(EVENT_DEFINITIONS[0].id)
  const [fields, setFields] = useState({
    userId:      DEFAULTS.userId,
    agentId:     DEFAULTS.agentId,
    displayName: DEFAULTS.displayName,
    description: DEFAULTS.description,
    externalId:  DEFAULTS.externalId,
    tags:        DEFAULTS.tags,
    assetType:   DEFAULTS.assetType,
    assetId:     DEFAULTS.assetId,
    ipAddress:   DEFAULTS.ipAddress,
  })

  const selectedDef = EVENT_DEFINITIONS.find(d => d.id === selectedEventId) || EVENT_DEFINITIONS[0]

  const handleFieldChange = useCallback((name, value) => {
    const next = { ...fields, [name]: value }
    setFields(next)
    onInputChange?.(selectedDef.kind, next, selectedEventId)
  }, [fields, selectedDef, selectedEventId, onInputChange])

  const handleEventSelect = useCallback((def) => {
    setSelectedEventId(def.id)
    onInputChange?.(def.kind, fields, def.id)
  }, [fields, onInputChange])

  function handleSubmit(e) {
    e.preventDefault()
    if (isRunning) return
    onSend(selectedDef.kind, fields, selectedEventId)
  }

  const canSend = !isRunning && (
    fields.userId.trim() || fields.agentId.trim() || fields.displayName.trim()
  )

  return (
    <form className={styles.wrap} onSubmit={handleSubmit}>
      {/* ── Event Type Selector ── */}
      <div className={styles.selectorSection}>
        <div className={styles.selectorLabel}>
          <span className={styles.sectionNum}>1</span>
          Select Scenario
        </div>
        <div className={styles.eventGrid}>
          {EVENT_DEFINITIONS.map(def => (
            <button
              key={def.id}
              type="button"
              className={`${styles.eventCard} ${selectedEventId === def.id ? styles.eventCardActive : ''} ${styles[`badge_${def.badgeColor}`]}`}
              onClick={() => handleEventSelect(def)}
              aria-pressed={selectedEventId === def.id}
            >
              <div className={styles.eventCardTop}>
                <span className={styles.eventIcon}>{def.icon}</span>
                <span className={`${styles.eventBadge} ${styles[`badge_${def.badgeColor}`]}`}>{def.badge}</span>
              </div>
              <div className={styles.eventLabel}>{def.label}</div>
              <div className={styles.eventScenario}>{def.scenario}</div>
              <div className={styles.eventDesc}>{def.description}</div>
              {selectedEventId === def.id && (
                <span className={styles.selectedCheck}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── URN / event id display ── */}
      <div className={styles.urnRow}>
        <span className={styles.urnLabel}>Event URN / Type</span>
        <code className={styles.urnValue}>{selectedDef.id}</code>
      </div>

      {/* ── Dynamic Fields ── */}
      <div className={styles.fieldsSection}>
        <div className={styles.selectorLabel}>
          <span className={styles.sectionNum}>2</span>
          Customize Payload
        </div>
        <div className={styles.fieldGrid}>
          {selectedDef.fields.map(name => {
            const meta = FIELD_META[name]
            if (!meta) return null
            return (
              <div key={name} className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`field-${name}`}>
                  {meta.label}
                </label>
                <input
                  id={`field-${name}`}
                  className={styles.fieldInput}
                  type="text"
                  placeholder={meta.placeholder}
                  value={fields[name] ?? ''}
                  onChange={e => handleFieldChange(name, e.target.value)}
                  autoComplete="off"
                />
                <span className={styles.fieldHint}>{meta.hint}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Send Button ── */}
      <div className={styles.actionRow}>
        <button className={`${styles.sendBtn} ${styles[`sendBtn_${selectedDef.badgeColor}`]}`} type="submit" disabled={!canSend}>
          {isRunning
            ? <><span className={styles.spinner}></span> Processing…</>
            : <>{selectedDef.icon} Send — {selectedDef.label}</>
          }
        </button>
        <div className={styles.caption}>
          {selectedDef.description}
        </div>
      </div>
    </form>
  )
}
