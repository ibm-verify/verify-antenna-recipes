import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventStream from './EventStream.jsx'

const makeRecord = (overrides = {}) => ({
  id:      '185321-123',
  ts:      '15:00:35',
  kind:    'vip',
  input:   {
    issue_type: 'Compromised User',
    risk:       'Critical',
    issue_time: '2026-10-06T15:00:32Z',
    issue_keys: { identity_id: '8120028SFS', agent_id: 'agent-uuid' },
    message:    '8120028SFS credentials were found in one or more data breaches',
  },
  output: {
    sub_id: {
      format: 'complex',
      user:   { format: 'opaque', id:    '8120028SFS' },
      agent:  { format: 'opaque', id:    'agent-uuid' },
    },
    events: {
      'https://schemas.openid.net/secevent/caep/event-type/risk-level-change': {
        current_level:  'HIGH',
        previous_level: 'LOW',
      },
    },
  },
  eventId: null,
  pushed:  false,
  ...overrides,
})

describe('EventStream', () => {
  it('renders the section title span', () => {
    render(<EventStream records={[]} />)
    expect(screen.getByText('📡 SSF Transformation Stream')).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    render(<EventStream records={[]} />)
    expect(screen.getByText(/send an event/i)).toBeInTheDocument()
  })

  it('renders an event card for each VIP record', () => {
    render(<EventStream records={[makeRecord(), makeRecord({ id: '185321-456' })]} />)
    expect(screen.getAllByTestId('event-card')).toHaveLength(2)
  })

  it('renders cards for all event kinds (no filtering)', () => {
    const unauthorized = makeRecord({
      id: 'u-1',
      kind: 'vip',
      input: { ...makeRecord().input, issue_type: 'Access to Unauthorized Countries' }
    })
    const scimCreate = makeRecord({ id: 'sc-1', kind: 'scim-create', input: { event_type: 'urn:ietf:params:scim:event:prov:create:full' } })
    render(<EventStream records={[unauthorized, scimCreate]} />)
    expect(screen.getAllByTestId('event-card')).toHaveLength(2)
  })

  it('shows the issue_type in the card header span', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getAllByText(/Compromised User/i)[0]).toBeInTheDocument()
  })

  it('shows the risk level in the card header', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('shows the timestamp in the card header', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getByText('15:00:35')).toBeInTheDocument()
  })

  it('renders Threat Detector Payload panel label', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getByText('⬇ Threat Detector Payload (sent)')).toBeInTheDocument()
  })

  it('renders SSF SET panel label', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getByText('⬆ SSF SET (output)')).toBeInTheDocument()
  })

  it('renders identity_id in at least one JSON panel', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getAllByText(/8120028SFS/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders complex sub_id in SSF JSON panel', () => {
    render(<EventStream records={[makeRecord()]} />)
    const pres = screen.getAllByText(/complex/)
    expect(pres.length).toBeGreaterThanOrEqual(1)
  })

  it('collapses card body when header is clicked', () => {
    render(<EventStream records={[makeRecord()]} />)
    expect(screen.getByText('⬇ Threat Detector Payload (sent)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('▾').closest('div'))
    expect(screen.queryByText('⬇ Threat Detector Payload (sent)')).not.toBeInTheDocument()
  })
})
