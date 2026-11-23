import { ISSUE_TYPES, IBM_VERIFY_EVENT_TYPES } from '../config.js'

let _seq = 0

/**
 * Build a VIP raw event payload to POST to the transmitter.
 * Only includes identity_id / agent_id if non-empty.
 *
 * @param {string} userId    - opaque IBM Verify user ID
 * @param {string} agentId   - opaque agent UUID
 * @param {string} issueType - one of ISSUE_TYPES values
 * @returns {object} VIP event payload
 */
export function buildVipPayload(userId, agentId, issueType = ISSUE_TYPES.COMPROMISED_USER) {
  const issueKeys = {}
  if (userId)  issueKeys.identity_id   = userId
  if (agentId) issueKeys.agent_id      = agentId

  const message = issueType === ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS
    ? `${userId} accessed a geo-blocked or sanctioned country`
    : `${userId} credentials were found in one or more data breaches`

  const prefix = issueType === ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS
    ? '183682' : '185321'

  return {
    flow_count:     1,
    incident_count: 1,
    issue_id:       `${prefix}-${Date.now()}-${++_seq}`,
    issue_keys:     issueKeys,
    issue_time:     new Date().toISOString(),
    issue_type:     issueType,
    message,
    playbook_name:  issueType,
    risk:           'Critical',
  }
}

/**
 * Build an "Unregistered Agent Detected" raw event payload.
 * Maps to urn:ibm:agent:unregistered_agent.
 * Matches the shape emitted by emit_unregistered_agent_event.sh.
 *
 * @param {object} fields - { displayName, description, externalId, userId, tags }
 * @returns {object}
 */
export function buildUnregisteredAgentPayload(fields) {
  const {
    displayName = '',
    description = '',
    externalId  = '',
    userId      = '',
    tags        = '',
  } = fields

  const sourceAgentId = `am-agent-${Date.now().toString(16).slice(-8)}`

  const agent = { displayName: displayName || 'Unnamed Agent' }
  if (description) agent.description = description
  if (externalId)  agent.externalIds = externalId.split(',').map(s => s.trim()).filter(Boolean)
  if (userId)      agent.owners      = [{ value: userId, type: 'User' }]
  if (tags)        agent.tags        = tags.split(',').map(s => s.trim()).filter(Boolean)

  const issueKeys = { authmind_agent_id: sourceAgentId }
  const firstExtId = externalId.split(',').map(s => s.trim()).filter(Boolean)[0]
  if (firstExtId) issueKeys.agent_external_id = firstExtId
  if (userId)     issueKeys.identity_id        = userId

  return {
    issue_id:      `agent-unregistered-${Date.now()}-${++_seq}`,
    issue_keys:    issueKeys,
    issue_time:    new Date().toISOString(),
    issue_type:    'Unregistered Agent Detected',
    playbook_name: 'Unregistered Agent Detected',
    message:       `Agent '${agent.displayName}' was observed making API calls but has no registration in IBM Verify.`,
    risk:          'High',
    agent,
  }
}

/**
 * Build an "Anomalous Agent Access" raw event payload.
 * Maps to urn:ibm:agent:anomalous_access.
 * Matches the shape emitted by emit_anomalous_access_event.sh.
 *
 * @param {object} fields - { agentId, userId, assetType, assetId, ipAddress }
 * @returns {object}
 */
export function buildAnomalousAccessPayload(fields) {
  const {
    agentId   = '',
    userId    = '',
    assetType = 'database',
    assetId   = '',
    ipAddress = '',
  } = fields

  const issueKeys = {}
  if (agentId)   issueKeys.agent_id      = agentId
  if (userId)    issueKeys.identity_id   = userId
  if (assetType) issueKeys.asset_type    = assetType
  if (assetId)   issueKeys.asset_id      = assetId
  if (ipAddress) issueKeys.ip_address    = ipAddress

  const tsNow = Date.now()

  return {
    issue_id:           `anomalous-access-${tsNow}-${++_seq}`,
    issue_keys:         issueKeys,
    issue_time:         new Date().toISOString(),
    issue_type:         'Anomalous Agent Access',
    playbook_name:      'AI Agents Accessing Unapproved Asset',
    message:            `Agent '${agentId}' accessed ${assetType} '${assetId}' outside its approved resource scope.`,
    risk:               'High',
    incident_timestamps: [tsNow],
  }
}

/**
 * Build an "Agent Invalid Owner" raw event payload.
 * Maps to urn:ibm:agent:invalid_owner.
 * Matches the shape emitted by emit_invalid_owner_event.sh.
 *
 * @param {object} fields - { agentId, userId }
 * @returns {object}
 */
export function buildInvalidOwnerPayload(fields) {
  const {
    agentId = '',
    userId  = '',
  } = fields

  const issueKeys = {}
  if (agentId) issueKeys.agent_id    = agentId
  if (userId)  issueKeys.identity_id = userId

  const payload = {
    issue_id:      `invalid-owner-${Date.now()}-${++_seq}`,
    issue_keys:    issueKeys,
    issue_time:    new Date().toISOString(),
    issue_type:    'Agent Invalid Owner',
    playbook_name: 'Agent with Missing or Invalid Owner',
    message:       userId
      ? `Agent '${agentId}' has no valid owner — the previously assigned account '${userId}' has been deactivated.`
      : `Agent '${agentId}' has no owner set.`,
    risk:          'High',
  }

  if (userId) {
    payload.previous_owner = { value: userId, type: 'User' }
  }

  return payload
}

/**
 * Build the appropriate payload based on event kind.
 *
 * @param {string} kind   - 'credential-compromised' | 'vip' | 'unregistered-agent' | 'anomalous-access' | 'invalid-owner'
 * @param {object} fields - all form field values
 * @returns {object}
 */
export function buildPayload(kind, fields) {
  if (kind === 'credential-compromised') return buildVipPayload(fields.userId, '', ISSUE_TYPES.COMPROMISED_USER)
  if (kind === 'unregistered-agent')     return buildUnregisteredAgentPayload(fields)
  if (kind === 'anomalous-access')       return buildAnomalousAccessPayload(fields)
  if (kind === 'invalid-owner')          return buildInvalidOwnerPayload(fields)
  // vip fallback (geo-anomaly)
  return buildVipPayload(fields.userId, fields.agentId, fields.issueType)
}
