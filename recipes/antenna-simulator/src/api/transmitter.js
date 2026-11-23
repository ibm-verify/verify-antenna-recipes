import { PROXY_URL } from '../config.js'

/**
 * POST a VIP event payload to the transmitter via the Vite dev proxy.
 *
 * @param {object} payload  - VIP event object from buildPayload()
 * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
 */
export async function sendVipEvent(payload) {
  try {
    const res = await fetch(`${PROXY_URL}/sources/vip/events`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10000),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
