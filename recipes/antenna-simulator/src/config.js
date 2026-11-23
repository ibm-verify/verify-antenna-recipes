// Central configuration — override via environment variables at build time
export const PROXY_URL = import.meta.env.VITE_PROXY_URL || ''

export const DEFAULTS = {
  userId:      '8120028SFS',
  agentId:     '01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b',
  displayName: 'Trade Agent Alpha',
  description: 'Trade Agent for Execution',
  externalId:  'spiffe://dune.spire.local/trade-agent-alpha',
  ownerValue:  '8120028SFS',
  ownerType:   'User',
  tags:        'langflow, trade-agent',
  status:      'ACTIVE',
  assetType:   'database',
  assetId:     'prod-db-01',
  ipAddress:   '192.168.55.21',
}

// VIP threat-detection issue types
export const ISSUE_TYPES = {
  COMPROMISED_USER:            'Compromised User',
  UNAUTHORIZED_COUNTRY_ACCESS: 'Access to Unauthorized Countries',
}

// Custom IBM Verify agent event URIs
export const IBM_VERIFY_EVENT_TYPES = {
  UNREGISTERED_AGENT: 'urn:ibm:agent:unregistered_agent',
  ANOMALOUS_ACCESS:   'urn:ibm:agent:anomalous_access',
  INVALID_OWNER:      'urn:ibm:agent:invalid_owner',
}

/**
 * All selectable scenarios — each entry is one clickable card in the UI.
 * `kind` drives which form fields / payload builder to use.
 * Cards are scenario-first: lead with the human-readable threat/business context,
 * then surface the technical event type as a badge + description detail.
 */
export const EVENT_DEFINITIONS = [
  {
    id:          ISSUE_TYPES.COMPROMISED_USER,
    kind:        'credential-compromised',
    label:       'Credential Compromised',
    scenario:    'Owner\'s API key leaked — their user token is being used in agentic activities',
    description: 'Owner\'s API key appeared in a public leak. Their direct user token is now being used by the agent, blurring the human/agent boundary and making the agent\'s access untrusted. SSF event: RISC credential-compromise. Playbook: Revoke User Sessions.',
    icon:        '🔓',
    badgeColor:  'red',
    badge:       'RISC',
    eventType:   ISSUE_TYPES.COMPROMISED_USER,
    fields:      ['userId'],
  },
  {
    id:          ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS,
    kind:        'vip',
    label:       'Geo-Anomaly Detected',
    scenario:    'Agent token used from a geo-blocked or sanctioned country',
    description: 'Access originated from a region outside approved policy. The agent\'s session is flagged as high-risk. SSF event: CAEP risk-level-change. Playbook: Suspend Agent.',
    icon:        '🌍',
    badgeColor:  'yellow',
    badge:       'CAEP',
    eventType:   ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS,
    fields:      ['userId', 'agentId'],
  },
  {
    id:          IBM_VERIFY_EVENT_TYPES.UNREGISTERED_AGENT,
    kind:        'unregistered-agent',
    label:       'Shadow Agent Detected',
    scenario:    'An agent making API calls has no registration in IBM Verify',
    description: 'Agent identity exists in the runtime but was never registered or governed. IBM Verify playbook: onboard and register the agent identity.',
    icon:        '🤖',
    badgeColor:  'blue',
    badge:       'IBM Verify',
    eventType:   IBM_VERIFY_EVENT_TYPES.UNREGISTERED_AGENT,
    fields:      ['displayName', 'description', 'externalId', 'userId', 'tags'],
  },
  {
    id:          IBM_VERIFY_EVENT_TYPES.ANOMALOUS_ACCESS,
    kind:        'anomalous-access',
    label:       'Anomalous Asset Access',
    scenario:    'AI agent accessed a production asset outside its approved scope',
    description: 'Agent identity accessed a resource it was never authorised for. IBM Verify playbook: suspend the agent and revoke its access.',
    icon:        '⚠️',
    badgeColor:  'red',
    badge:       'IBM Verify',
    eventType:   IBM_VERIFY_EVENT_TYPES.ANOMALOUS_ACCESS,
    fields:      ['agentId', 'userId', 'assetType', 'assetId', 'ipAddress'],
  },
  {
    id:          IBM_VERIFY_EVENT_TYPES.INVALID_OWNER,
    kind:        'invalid-owner',
    label:       'Agent with Invalid Owner',
    scenario:    'Agent identity owner account was deleted or deactivated',
    description: 'The human owner of this agent no longer exists or is inactive. IBM Verify playbook: reassign the agent to a valid owner.',
    icon:        '👤',
    badgeColor:  'yellow',
    badge:       'IBM Verify',
    eventType:   IBM_VERIFY_EVENT_TYPES.INVALID_OWNER,
    fields:      ['agentId', 'userId'],
  },
]
