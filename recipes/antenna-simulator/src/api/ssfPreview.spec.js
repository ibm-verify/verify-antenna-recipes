import { describe, it, expect } from 'vitest'
import { buildSSFPreview } from './ssfPreview.js'
import { buildPayload }    from './payload.js'
import { ISSUE_TYPES }     from '../config.js'

const CAEP_RISK = 'https://schemas.openid.net/secevent/caep/event-type/risk-level-change'
const RISC_CRED = 'https://schemas.openid.net/secevent/risc/event-type/credential-compromise'

function makeVipPayload(userId, agentId, issueType = ISSUE_TYPES.COMPROMISED_USER) {
  return buildPayload('vip', { userId, agentId, issueType })
}

describe('buildSSFPreview', () => {
  describe('subject (sub_id)', () => {
    it('produces complex sub_id when both userId and agentId provided', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.output.sub_id.format).toBe('complex')
      expect(r.output.sub_id.user.email).toBe('alice@ibm.com')
      expect(r.output.sub_id.agent.id).toBe('agent-uuid')
    })

    it('produces opaque sub_id when only agentId provided', () => {
      const p = makeVipPayload('', 'agent-uuid')
      const r = buildSSFPreview('vip', '', 'agent-uuid', p)
      expect(r.output.sub_id.format).toBe('opaque')
      expect(r.output.sub_id.id).toBe('agent-uuid')
    })

    it('produces email sub_id when only userId provided', () => {
      const p = makeVipPayload('alice@ibm.com', '')
      const r = buildSSFPreview('vip', 'alice@ibm.com', '', p)
      expect(r.output.sub_id.format).toBe('email')
      expect(r.output.sub_id.email).toBe('alice@ibm.com')
    })
  })

  describe('events — Compromised User', () => {
    it('includes credential-compromise event only (no risk-level-change)', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.output.events[RISC_CRED]).toBeDefined()
      expect(r.output.events[CAEP_RISK]).toBeUndefined()
    })

    it('credential-compromise has credential_type email for email userId', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.output.events[RISC_CRED].credential_type).toBe('email')
    })

    it('credential-compromise has credential_type password for opaque userId', () => {
      const p = makeVipPayload('8120028SFS', 'agent-uuid')
      const r = buildSSFPreview('vip', '8120028SFS', 'agent-uuid', p)
      expect(r.output.events[RISC_CRED].credential_type).toBe('password')
    })
  })

  describe('events — Access to Unauthorized Countries', () => {
    it('includes risk-level-change event', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.output.events[CAEP_RISK]).toBeDefined()
    })

    it('does NOT include credential-compromise for unauthorized access', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.output.events[RISC_CRED]).toBeUndefined()
    })

    it('reason_user reflects unauthorized activity message', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid', ISSUE_TYPES.UNAUTHORIZED_COUNTRY_ACCESS)
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.output.events[CAEP_RISK].reason_user.en).toContain('unauthorized activities')
    })
  })

  describe('record shape', () => {
    it('id matches payload issue_id', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.id).toBe(p.issue_id)
    })

    it('input matches the payload', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.input).toBe(p)
    })

    it('eventId is null initially', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.eventId).toBeNull()
    })

    it('pushed is false initially', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.pushed).toBe(false)
    })

    it('ts is a valid HH:MM:SS string', () => {
      const p = makeVipPayload('alice@ibm.com', 'agent-uuid')
      const r = buildSSFPreview('vip', 'alice@ibm.com', 'agent-uuid', p)
      expect(r.ts).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })
})
