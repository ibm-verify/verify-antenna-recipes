import React from 'react'
import styles from './Pipeline.module.css'

// Per-kind configuration for the Playbook Action node
const ACTION_CONFIG = {
  'credential-compromised': {
    badge:      'Playbook Action',
    badgeColor: 'red',
    icon:       '🔓',
    label:      'Revoke User Sessions',
    sub:        'Invalidate compromised user tokens',
    activeClass: styles.nodeAction,
  },
  'vip': {
    badge:      'Playbook Action',
    badgeColor: 'red',
    icon:       '⚡',
    label:      'Suspend Agent',
    sub:        'Revoke Agent Identity Access',
    activeClass: styles.nodeAction,
  },
  'unregistered-agent': {
    badge:      'Playbook Action',
    badgeColor: 'cyan',
    icon:       '🤖',
    label:      'Onboard Agent',
    sub:        'Register Agent Identity in IBM Verify',
    activeClass: styles.nodeActionCreate,
  },
  'anomalous-access': {
    badge:      'Playbook Action',
    badgeColor: 'red',
    icon:       '⚡',
    label:      'Suspend Agent',
    sub:        'Anomalous access — revoke agent identity',
    activeClass: styles.nodeAction,
  },
  'invalid-owner': {
    badge:      'Playbook Action',
    badgeColor: 'yellow',
    icon:       '👤',
    label:      'Assign Owner',
    sub:        'Reassign Agent Identity in IBM Verify',
    activeClass: styles.nodeActionPatch,
  },
}

function FlowNode({ testId, badge, badgeColor, icon, label, sub, active, extraClass }) {
  return (
    <div
      className={`${styles.node} ${active ? styles.active : ''} ${active && extraClass ? extraClass : ''}`}
      data-testid={testId}
    >
      <div className={`${styles.badge} ${badgeColor ? styles[badgeColor] : ''}`}>{badge}</div>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.label}>{label}</div>
      <div className={styles.sub}>{sub}</div>
    </div>
  )
}

function FlowArrow({ labelTop, labelBot, packetActive }) {
  return (
    <div className={styles.arrow}>
      <div className={styles.arrowLabelTop}>{labelTop}</div>
      <div className={styles.arrowWrap}>
        <div className={styles.arrowLine}>
          <div className={`${styles.packet} ${packetActive ? styles.sending : ''}`}></div>
        </div>
        <div className={styles.arrowHead}></div>
      </div>
      <div className={styles.arrowLabelBot}>{labelBot}</div>
    </div>
  )
}

export default function Pipeline({ status, packets, kind = 'vip' }) {
  const action = ACTION_CONFIG[kind] || ACTION_CONFIG['vip']

  return (
    <div className={styles.flowRow}>
      <FlowNode
        testId="node-vip"
        badge="Source" badgeColor="yellow"
        icon="🛡️" label="Threat Detector" sub="e.g. VIP (AuthMind), CrowdStrike"
        active={status.vip}
      />
      <FlowArrow labelTop="Raw JSON POST" labelBot="/sources/vip/events" packetActive={packets.pkt1} />
      <FlowNode
        testId="node-tx"
        badge="Self-Hosted"
        icon="📡" label="Antenna Transmitter" sub="Transforms to SSF SET"
        active={status.tx}
      />
      <FlowArrow labelTop="SSF SET (Push)" labelBot="RFC 8935 / Signed JWT" packetActive={packets.pkt2} />
      <FlowNode
        testId="node-rx"
        badge="Verify Tenant" badgeColor="green"
        icon="☁️" label="IBM Verify Antenna" sub="Receives &amp; Validates SSF"
        active={status.rx}
      />
      <FlowArrow labelTop="Runs Playbook" labelBot="Trigger Automation" packetActive={packets.pkt3} />
      <FlowNode
        testId="node-action"
        badge={action.badge}
        badgeColor={action.badgeColor}
        icon={action.icon}
        label={action.label}
        sub={action.sub}
        active={status.action}
        extraClass={action.activeClass}
      />
    </div>
  )
}
