import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TopBar from './TopBar.jsx'
import { AppProvider } from '../../context/AppContext.jsx'

function renderTopBar(props = {}) {
  return render(
    <AppProvider>
      <TopBar actionCount={props.actionCount ?? 0} />
    </AppProvider>
  )
}

describe('TopBar', () => {
  it('renders the IBM logo text', () => {
    renderTopBar()
    expect(screen.getByText('IBM')).toBeInTheDocument()
  })

  it('renders the app title', () => {
    renderTopBar()
    expect(screen.getByText(/Verify Threat Event Simulator/i)).toBeInTheDocument()
  })

  it('renders the pipeline subtitle', () => {
    renderTopBar()
    expect(screen.getByText(/Agent Identity Threat Detection/i)).toBeInTheDocument()
  })

  it('shows "0 actions triggered" initially', () => {
    renderTopBar({ actionCount: 0 })
    expect(screen.getByText(/0 actions triggered/i)).toBeInTheDocument()
  })

  it('shows correct action count when non-zero', () => {
    renderTopBar({ actionCount: 3 })
    expect(screen.getByText(/3 actions triggered/i)).toBeInTheDocument()
  })

  it('uses singular "action" for count of 1', () => {
    renderTopBar({ actionCount: 1 })
    expect(screen.getByText(/1 action triggered/i)).toBeInTheDocument()
    expect(screen.queryByText(/1 actions triggered/i)).not.toBeInTheDocument()
  })

  it('renders Pipeline Active status label', () => {
    renderTopBar()
    expect(screen.getByText(/Pipeline Active/i)).toBeInTheDocument()
  })

  it('renders the dark/light mode toggle button', () => {
    renderTopBar()
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })
})
