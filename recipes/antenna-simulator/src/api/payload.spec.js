import { describe, it, expect } from 'vitest'
import { buildPayload, buildVipPayload } from './payload.js'
import { ISSUE_TYPES } from '../config.js'

describe('buildVipPayload (via buildPayload)', () => {
  const vip = (userId, agentId, issueType) =>
    buildPayload('vip', { userId, agentId, issueType: issueType || ISSUE_TYPES.COMPROMISED_USER })

  it('sets identity_id from userId', () => {
    const p = vip('8120028SFS', '')
    expect(p.issue_keys.identity_id).toBe('8120028SFS')
    expect(p.issue_keys.identity_name).toBeUndefined()
  })

  it('sets agent_id from agentId', () => {
    const p = vip('8120028SFS', 'agent-uuid-123')
    expect(p.issue_keys.agent_id).toBe('agent-uuid-123')
  })

  it('sets issue_type to Compromised User by default', () => {
    const p = vip('8120028SFS', 'agent-uuid-123')
    expect(p.issue_type).toBe('Compromised User')
  })

  it('sets issue_type to Access to Unauthorized Countries when specified', () => {
    const p = vip('8120028SFS', 'agent-uuid-123', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
    expect(p.issue_type).toBe('Access to Unauthorized Countries')
  })

  it('builds message from userId for Compromised User', () => {
    const p = vip('8120028SFS', 'agent-uuid-123')
    expect(p.message).toContain('8120028SFS')
    expect(p.message).toContain('data breaches')
  })

  it('builds message from userId for Unauthorized Countries', () => {
    const p = vip('8120028SFS', 'agent-uuid-123', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
    expect(p.message).toContain('8120028SFS')
    expect(p.message).toContain('geo-blocked')
  })

  it('sets risk to Critical', () => {
    const p = vip('8120028SFS', 'agent-uuid-123')
    expect(p.risk).toBe('Critical')
  })

  it('generates a unique issue_id on each call', () => {
    const p1 = vip('8120028SFS', 'agent-uuid-123')
    const p2 = vip('8120028SFS', 'agent-uuid-123')
    expect(p1.issue_id).not.toBe(p2.issue_id)
  })

  it('sets issue_time as a valid ISO string', () => {
    const p = vip('8120028SFS', 'agent-uuid-123')
    expect(() => new Date(p.issue_time)).not.toThrow()
    expect(new Date(p.issue_time).toISOString()).toBe(p.issue_time)
  })

  it('omits agent_id from issue_keys when empty string provided', () => {
    const p = vip('8120028SFS', '')
    expect(p.issue_keys.agent_id).toBeUndefined()
  })

  it('omits identity_id from issue_keys when empty string provided', () => {
    const p = vip('', 'agent-uuid-123')
    expect(p.issue_keys.identity_id).toBeUndefined()
  })
})
