import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './TopBar.module.css'

export default function TopBar({ actionCount }) {
  const { state, toggleTheme } = useApp()
  const isDark = state.theme === 'dark'
  const label  = `${actionCount} action${actionCount !== 1 ? 's' : ''} triggered`

  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        {/* IBM logo block */}
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="4" fill="#0f62fe"/>
          <text x="14" y="19" fontSize="12" fill="white" textAnchor="middle"
                fontFamily="monospace" fontWeight="bold">IBM</text>
        </svg>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Verify Threat Event Simulator</span>
          <span className={styles.subtitle}>Agent Identity Threat Detection</span>
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.dot}></span>
        <span className={styles.statusLabel}>Pipeline Active</span>

        <span className={styles.counter}>{label}</span>

        {/* Dark / Light mode toggle */}
        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className={styles.toggleTrack} aria-hidden="true">
            <span className={`${styles.toggleThumb} ${isDark ? styles.thumbDark : styles.thumbLight}`}></span>
          </span>
          <span className={styles.toggleLabel}>
            {isDark ? '🌙' : '☀️'}
          </span>
        </button>
      </div>
    </header>
  )
}
