import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Pipeline from './Pipeline.jsx'

const defaultStatus  = { vip: false, tx: false, rx: false, action: false }
const defaultPackets = { pkt1: false, pkt2: false, pkt3: false }

describe('Pipeline', () => {
  it('renders Threat Detector source node', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} />)
    expect(screen.getByText(/Threat Detector/i)).toBeInTheDocument()
  })

  it('renders Antenna Transmitter node', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} />)
    expect(screen.getByText(/Antenna Transmitter/i)).toBeInTheDocument()
  })

  it('renders IBM Verify Antenna node', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} />)
    expect(screen.getByText(/IBM Verify Antenna/i)).toBeInTheDocument()
  })

  it('defaults to Suspend Agent action node for vip kind', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} kind="vip" />)
    expect(screen.getByText(/Suspend Agent/i)).toBeInTheDocument()
    expect(screen.getByText(/Revoke Agent Identity Access/i)).toBeInTheDocument()
  })

  it('shows Onboard Agent action node for unregistered-agent (shadow agent) kind', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} kind="unregistered-agent" />)
    expect(screen.getByText(/Onboard Agent/i)).toBeInTheDocument()
    expect(screen.getByText(/Register Agent Identity in IBM Verify/i)).toBeInTheDocument()
  })

  it('shows Suspend Agent action node for anomalous-access kind', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} kind="anomalous-access" />)
    expect(screen.getByText(/Suspend Agent/i)).toBeInTheDocument()
    expect(screen.getByText(/Anomalous access — revoke agent identity/i)).toBeInTheDocument()
  })

  it('shows Assign Owner action node for invalid-owner kind', () => {
    render(<Pipeline status={defaultStatus} packets={defaultPackets} kind="invalid-owner" />)
    expect(screen.getByText(/Assign Owner/i)).toBeInTheDocument()
    expect(screen.getByText(/Reassign Agent Identity in IBM Verify/i)).toBeInTheDocument()
  })

  it('applies active class to vip node when status.vip is true', () => {
    render(<Pipeline status={{ ...defaultStatus, vip: true }} packets={defaultPackets} />)
    const node = screen.getByTestId('node-vip')
    expect(node.className).toMatch(/active/)
  })
})
