import { ISSUE_TYPES, IBM_VERIFY_EVENT_TYPES } from '../config.js'

const CAEP_RISK = 'https://schemas.openid.net/secevent/caep/event-type/risk-level-change'
const RISC_CRED = 'https://schemas.openid.net/secevent/risc/event-type/credential-compromise'
const SCIM_AGENT_SCHEMA = 'urn:ietf:params:scim:schemas:core:ibm:2.0:Agent'

/**
 * Build SSF SET preview for VIP events.
 * - Compromised User  → RISC credential-compromise only
 * - Geo-Anomaly       → CAEP risk-level-change only
 * Mirrors transformCompromisedUserEvent / transformAccessToUnauthorizedCountriesEvent
 * in vip_event_mapper.js.
 */
function buildVipSsfPreview(userId, agentId, payload) {
  // Mirror mapper subject logic: identity_id is an opaque IBM Verify user ID
  const user = { format: 'opaque', id: userId }
  let sub_id
  if (userId && agentId) {
    sub_id = {
      format: 'complex',
      user,
      agent:  { format: 'opaque', id: agentId },
    }
  } else if (agentId) {
    sub_id = { format: 'opaque', id: agentId }
  } else {
    sub_id = user
  }

  const ts = new Date(payload.issue_time).getTime()
  const events = {}

  if (payload.issue_type === ISSUE_TYPES.COMPROMISED_USER) {
    const adminReason = 'Credentials for agent owner were found in one or more data breaches'
    events[RISC_CRED] = {
      event_type:      RISC_CRED,
      credential_type: 'password',
      reason_admin:    { en: adminReason },
      reason_user:     { en: 'Your account has been compromised' },
      event_timestamp: ts,
    }
  } else {
    // UNAUTHORIZED_COUNTRY_ACCESS → CAEP risk-level-change only
    const adminReason = payload.message || 'Access from a geo-blocked or sanctioned country detected'
    events[CAEP_RISK] = {
      event_type:      CAEP_RISK,
      current_level:   'HIGH',
      previous_level:  'LOW',
      principal:       'USER',
      risk_reason:     adminReason,
      reason_admin:    { en: adminReason },
      reason_user:     { en: 'Your account is being used to perform unauthorized activities' },
      event_timestamp: ts,
    }
  }

  return { sub_id, events }
}

/**
 * Build SSF SET preview for urn:ibm:agent:unregistered_agent.
 * Mirrors transformUnregisteredAgentEvent in vip_event_mapper.js.
 */
function buildUnregisteredAgentSsfPreview(payload) {
  const sourceAgentId = payload.issue_keys?.authmind_agent_id || 'unknown'
  const externalId    = payload.issue_keys?.agent_external_id

  const sub_id = { format: 'scim', uri: `/Agents/${sourceAgentId}` }
  if (externalId) sub_id.externalId = externalId

  const agent = payload.agent || {}
  const data  = {
    schemas:     [SCIM_AGENT_SCHEMA],
    displayName: agent.displayName || 'Unnamed Agent',
  }
  ;['description', 'externalIds', 'owners', 'tags'].forEach(attr => {
    if (agent[attr] !== undefined && agent[attr] !== null) data[attr] = agent[attr]
  })

  const events = {
    [IBM_VERIFY_EVENT_TYPES.UNREGISTERED_AGENT]: {
      event_type:      IBM_VERIFY_EVENT_TYPES.UNREGISTERED_AGENT,
      data,
      reason_admin:    { en: payload.message },
      event_timestamp: new Date(payload.issue_time).getTime(),
    },
  }

  return { sub_id, events }
}

/**
 * Build SSF SET preview for urn:ibm:agent:anomalous_access.
 * Mirrors transformAnomalousAccessEvent in vip_event_mapper.js.
 */
function buildAnomalousAccessSsfPreview(payload) {
  const keys     = payload.issue_keys || {}
  const agentId  = keys.agent_id  || 'unknown'
  const userId   = keys.identity_id
  const ipAddress = keys.ip_address

  const agent = { format: 'opaque', id: agentId }
  const sub_id = { format: 'complex', agent }
  if (userId)    sub_id.user    = { format: 'opaque', id: userId }
  if (ipAddress) sub_id.session = { format: 'opaque', id: ipAddress }

  const ts = new Date(payload.issue_time).getTime()
  const event = {
    event_type:  IBM_VERIFY_EVENT_TYPES.ANOMALOUS_ACCESS,
    asset_type:  keys.asset_type,
    asset_id:    keys.asset_id,
    reason_admin: { en: payload.message },
    event_timestamp: ts,
  }
  if (payload.incident_timestamps) event.incident_timestamps = payload.incident_timestamps

  return { sub_id, events: { [IBM_VERIFY_EVENT_TYPES.ANOMALOUS_ACCESS]: event } }
}

/**
 * Build SSF SET preview for urn:ibm:agent:invalid_owner.
 * Mirrors transformInvalidOwnerEvent in vip_event_mapper.js.
 */
function buildInvalidOwnerSsfPreview(payload) {
  const agentId = payload.issue_keys?.agent_id || 'unknown'
  const sub_id  = { format: 'opaque', id: agentId }

  const event = {
    event_type:      IBM_VERIFY_EVENT_TYPES.INVALID_OWNER,
    reason_admin:    { en: payload.message },
    event_timestamp: new Date(payload.issue_time).getTime(),
  }
  if (payload.previous_owner) event.previous_owner = payload.previous_owner

  return { sub_id, events: { [IBM_VERIFY_EVENT_TYPES.INVALID_OWNER]: event } }
}

/**
 * Mirror the vip_event_mapper.js subject-building logic in JS so the UI can
 * show the expected SSF SET without reading the transmitter log.
 *
 * @param {string} kind     - 'credential-compromised' | 'vip' | 'unregistered-agent' | 'anomalous-access' | 'invalid-owner'
 * @param {string} userId   - identity from form fields
 * @param {string} agentId  - agent id from form fields
 * @param {object} payload  - full payload from buildPayload()
 * @returns {object}  TransformRecord shape { id, ts, input, output, kind, eventId, pushed }
 */
export function buildSSFPreview(kind, userId, agentId, payload) {
  let output
  if (kind === 'unregistered-agent') {
    output = buildUnregisteredAgentSsfPreview(payload)
  } else if (kind === 'anomalous-access') {
    output = buildAnomalousAccessSsfPreview(payload)
  } else if (kind === 'invalid-owner') {
    output = buildInvalidOwnerSsfPreview(payload)
  } else {
    // 'credential-compromised' passes agentId='' so no agent in sub_id
    // 'vip' (geo-anomaly) passes both userId and agentId
    output = buildVipSsfPreview(userId, agentId, payload)
  }

  const now = new Date()
  const hms = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':')

  return {
    id:      payload.issue_id,
    ts:      hms,
    kind,
    input:   payload,
    output,
    eventId: null,
    pushed:  false,
  }
}
