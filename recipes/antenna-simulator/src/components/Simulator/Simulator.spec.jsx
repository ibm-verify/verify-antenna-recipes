import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Simulator from './Simulator.jsx'
import { AppProvider } from '../../context/AppContext.jsx'

function renderSimulator(props = {}) {
  return render(
    <AppProvider>
      <Simulator onSend={props.onSend || vi.fn()} />
    </AppProvider>
  )
}

describe('Simulator', () => {
  it('renders User ID input field', () => {
    renderSimulator()
    expect(screen.getByLabelText(/user id/i)).toBeInTheDocument()
  })

  it('renders Agent ID input field on a scenario that has it', async () => {
    const user = userEvent.setup()
    renderSimulator()
    // Switch to geo-anomaly which has agentId
    await user.click(screen.getByRole('button', { name: /geo-anomaly detected/i }))
    expect(screen.getByLabelText(/agent id/i)).toBeInTheDocument()
  })

  it('renders a Send button with the selected scenario label', () => {
    renderSimulator()
    // The send button text includes the selected event's label — "Credential Compromised" by default
    expect(screen.getByRole('button', { name: /send.*credential compromised/i })).toBeInTheDocument()
  })

  it('pre-fills User ID with default value', () => {
    renderSimulator()
    expect(screen.getByLabelText(/user id/i)).toHaveValue('8120028SFS')
  })

  it('pre-fills Agent ID with default value on geo-anomaly scenario', async () => {
    const user = userEvent.setup()
    renderSimulator()
    await user.click(screen.getByRole('button', { name: /geo-anomaly detected/i }))
    expect(screen.getByLabelText(/agent id/i)).toHaveValue('01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b')
  })

  it('disables Send button when userId, agentId and displayName are all empty', async () => {
    const user = userEvent.setup()
    renderSimulator()
    // credential-compromised only has userId — clear it
    await user.clear(screen.getByLabelText(/user id/i))
    // switch to geo-anomaly to also clear agentId from state
    await user.click(screen.getByRole('button', { name: /geo-anomaly detected/i }))
    await user.clear(screen.getByLabelText(/agent id/i))
    // switch to shadow agent to also clear displayName from state
    await user.click(screen.getByRole('button', { name: /shadow agent detected/i }))
    await user.clear(screen.getByLabelText(/display name/i))
    expect(screen.getByRole('button', { name: /send/i, hidden: false })).toBeDisabled()
  })

  it('enables Send button when at least one field has a value', async () => {
    renderSimulator()
    // userId has default value — button should be enabled
    expect(screen.getByRole('button', { name: /send.*credential compromised/i })).not.toBeDisabled()
  })

  it('calls onSend with (kind, fields, eventId) when submitted', async () => {
    const user   = userEvent.setup()
    const onSend = vi.fn()
    renderSimulator({ onSend })

    await user.clear(screen.getByLabelText(/user id/i))
    await user.type(screen.getByLabelText(/user id/i), '8120031ABC')

    await user.click(screen.getByRole('button', { name: /send.*credential compromised/i }))

    expect(onSend).toHaveBeenCalledOnce()
    const [kind, fields, eventId] = onSend.mock.calls[0]
    expect(kind).toBe('credential-compromised')
    expect(fields.userId).toBe('8120031ABC')
    expect(eventId).toBe('Compromised User')
  })

  it('shows all 5 scenario cards', () => {
    renderSimulator()
    expect(screen.getAllByRole('button', { name: /credential compromised/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /geo-anomaly detected/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /shadow agent detected/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /anomalous asset access/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /agent with invalid owner/i }).length).toBeGreaterThanOrEqual(1)
  })
})
