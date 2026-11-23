import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendVipEvent } from './transmitter.js'

describe('sendVipEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /sources/vip/events with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201 })
    vi.stubGlobal('fetch', mockFetch)

    const payload = { issue_type: 'Compromised User', issue_keys: { identity_id: '8120028SFS' } }
    await sendVipEvent(payload)

    expect(mockFetch).toHaveBeenCalledWith(
      '/sources/vip/events',
      expect.objectContaining({
        method:  'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify(payload),
      })
    )
  })

  it('returns { ok: true, status } on 201', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }))
    const result = await sendVipEvent({})
    expect(result).toEqual({ ok: true, status: 201 })
  })

  it('returns { ok: true, status } on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const result = await sendVipEvent({})
    expect(result.ok).toBe(true)
  })

  it('returns { ok: false, status } on 4xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }))
    const result = await sendVipEvent({})
    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
  })

  it('returns { ok: false, error } when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))
    const result = await sendVipEvent({})
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Network down')
  })
})
