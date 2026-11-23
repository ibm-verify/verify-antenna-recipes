import React, { useEffect, useRef } from 'react'
import styles from './Log.module.css'

const LEVEL_CLASS = {
  info:   styles.info,
  ok:     styles.ok,
  warn:   styles.warn,
  threat: styles.threat,
}

export default function Log({ entries, onClear }) {
  const termRef = useRef(null)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [entries])

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.activeDot}></span>
        <span className={styles.title}>Live Execution Console</span>
        <span className={styles.subtitle}>— End-to-end security pipeline trace</span>
        <button className={styles.clearBtn} onClick={onClear}>Clear</button>
      </div>

      <div className={styles.terminal} ref={termRef}>
        {entries.length === 0 ? (
          <>
            <LogLine ts="00:00:00" level="info"  msg="IBM Verify Antenna pipeline active — monitoring agent token activity across all users and agents." />
            <LogLine ts="00:00:00" level="info"  msg='Click "Send Threat Event" to simulate detection of anomalous agent token activity.' />
          </>
        ) : (
          entries.map(e => (
            <LogLine key={e.id} ts={e.ts} level={e.level} msg={e.msg} />
          ))
        )}
      </div>
    </section>
  )
}

function LogLine({ ts, level, msg }) {
  return (
    <div className={styles.line}>
      <span className={styles.ts}>{ts}</span>
      <span className={`${styles.level} ${LEVEL_CLASS[level] || ''}`}>{level.toUpperCase()}</span>
      {/* msg may contain safe HTML spans for coloured highlights */}
      <span className={styles.msg} dangerouslySetInnerHTML={{ __html: msg }} />
    </div>
  )
}
