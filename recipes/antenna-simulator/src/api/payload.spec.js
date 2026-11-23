import { describe, it, expect } from 'vitest'
import { buildPayload, buildVipPayload } from './payload.js'
import { ISSUE_TYPES } from '../config.js'

describe('buildVipPayload (via buildPayload)', () => {
  const vip = (userId, agentId, issueType) =>
    buildPayload('vip', { userId, agentId, issueType: issueType || ISSUE_TYPES.COMPROMISED_USER })

  it('sets identity_name from userId', () => {
    const p = vip('alice@ibm.com', '')
    expect(p.issue_keys.identity_name).toBe('alice@ibm.com')
  })

  it('sets agent_id from agentId', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123')
    expect(p.issue_keys.agent_id).toBe('agent-uuid-123')
  })

  it('sets issue_type to Compromised User by default', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123')
    expect(p.issue_type).toBe('Compromised User')
  })

  it('sets issue_type to Access to Unauthorized Countries when specified', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
    expect(p.issue_type).toBe('Access to Unauthorized Countries')
  })

  it('builds message from userId for Compromised User', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123')
    expect(p.message).toContain('alice@ibm.com')
    expect(p.message).toContain('data breaches')
  })

  it('builds message from userId for Unauthorized Countries', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
    expect(p.message).toContain('alice@ibm.com')
    expect(p.message).toContain('geo-blocked')
  })

  it('sets risk to Critical', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123')
    expect(p.risk).toBe('Critical')
  })

  it('generates a unique issue_id on each call', () => {
    const p1 = vip('alice@ibm.com', 'agent-uuid-123')
    const p2 = vip('alice@ibm.com', 'agent-uuid-123')
    expect(p1.issue_id).not.toBe(p2.issue_id)
  })

  it('sets issue_time as a valid ISO string', () => {
    const p = vip('alice@ibm.com', 'agent-uuid-123')
    expect(() => new Date(p.issue_time)).not.toThrow()
    expect(new Date(p.issue_time).toISOString()).toBe(p.issue_time)
  })

  it('omits agent_id from issue_keys when empty string provided', () => {
    const p = vip('alice@ibm.com', '')
    expect(p.issue_keys.agent_id).toBeUndefined()
  })

  it('omits identity_name from issue_keys when empty string provided', () => {
    const p = vip('', 'agent-uuid-123')
    expect(p.issue_keys.identity_name).toBeUndefined()
  })
})
