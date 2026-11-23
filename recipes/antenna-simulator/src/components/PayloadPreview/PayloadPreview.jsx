import React from 'react'
import styles from './PayloadPreview.module.css'

/**
 * Live preview of the VIP payload that will be / was sent to the transmitter.
 * @param {object}  payload    - result of buildPayload() — updates on every keystroke
 * @param {object|null} sentStatus - null | { ok, status?, error?, ts }
 */
export default function PayloadPreview({ payload, sentStatus }) {
  const json = JSON.stringify(payload, null, 2)

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.icon}>📤</span>
        <span className={styles.title}>VIP Payload Preview</span>
        <span className={styles.hint}>live · updates as you type</span>
      </div>

      <pre className={styles.code}>{json}</pre>

      <div className={styles.footer}>
        {sentStatus === null ? (
          <span className={styles.awaiting}>⏸ Awaiting send...</span>
        ) : sentStatus.ok ? (
          <span className={styles.success}>
            ✅ Sent&nbsp;&nbsp;{sentStatus.ts}&nbsp;&nbsp;HTTP {sentStatus.status}
          </span>
        ) : (
          <span className={styles.error}>
            ❌ {sentStatus.error
              ? sentStatus.error
              : `HTTP ${sentStatus.status}`}
            &nbsp;&nbsp;{sentStatus.ts}
          </span>
        )}
      </div>
    </section>
  )
}
