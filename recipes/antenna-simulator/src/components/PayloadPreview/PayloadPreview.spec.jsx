import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PayloadPreview from './PayloadPreview.jsx'

const basePayload = {
  issue_id:       '185321-123',
  issue_keys:     { identity_id: '8120028SFS', agent_id: 'agent-uuid' },
  issue_time:     '2026-10-06T15:00:32Z',
  issue_type:     'Compromised User',
  message:        '8120028SFS credentials were found in one or more data breaches',
  playbook_name:  'Compromised User',
  risk:           'Critical',
}

describe('PayloadPreview', () => {
  it('renders the section heading', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.getByText(/VIP Payload Preview/i)).toBeInTheDocument()
  })

  it('renders identity_id in the JSON preview', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.getByText(/8120028SFS/)).toBeInTheDocument()
  })

  it('renders agent_id in the JSON preview', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.getByText(/agent-uuid/)).toBeInTheDocument()
  })

  it('renders issue_type in the JSON preview', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.getByText(/Compromised User/)).toBeInTheDocument()
  })

  it('renders risk level in the JSON preview', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.getByText(/Critical/)).toBeInTheDocument()
  })

  it('does NOT show sent status when sentStatus is null', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.queryByText(/Sent/i)).not.toBeInTheDocument()
  })

  it('shows sent status badge with HTTP 201 after successful send', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={{ ok: true, status: 201, ts: '15:00:32' }} />)
    expect(screen.getByText(/Sent/i)).toBeInTheDocument()
    expect(screen.getByText(/201/)).toBeInTheDocument()
  })

  it('shows error badge on failed send', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={{ ok: false, status: 400, ts: '15:00:32' }} />)
    expect(screen.getByText(/400/)).toBeInTheDocument()
  })

  it('shows network error message when error string present', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={{ ok: false, error: 'Network down', ts: '15:00:32' }} />)
    expect(screen.getByText(/Network down/i)).toBeInTheDocument()
  })

  it('renders "Awaiting send..." label when sentStatus is null', () => {
    render(<PayloadPreview payload={basePayload} sentStatus={null} />)
    expect(screen.getByText(/Awaiting send/i)).toBeInTheDocument()
  })
})
