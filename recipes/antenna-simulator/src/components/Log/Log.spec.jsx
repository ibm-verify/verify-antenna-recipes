import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Log from './Log.jsx'
import { AppProvider } from '../../context/AppContext.jsx'

const entries = [
  { id: '1', ts: '10:00:00', level: 'info',   msg: 'Pipeline initialised' },
  { id: '2', ts: '10:00:01', level: 'threat',  msg: 'ROGUE AGENT DETECTED' },
  { id: '3', ts: '10:00:02', level: 'ok',      msg: 'Event accepted' },
  { id: '4', ts: '10:00:03', level: 'warn',    msg: 'Proxy unreachable' },
]

function renderLog(props = {}) {
  return render(
    <AppProvider>
      <Log entries={props.entries || []} onClear={props.onClear || (() => {})} />
    </AppProvider>
  )
}

describe('Log', () => {
  it('renders the Live Execution Console heading', () => {
    renderLog()
    expect(screen.getByText(/Live Execution Console/i)).toBeInTheDocument()
  })

  it('renders each log entry message', () => {
    renderLog({ entries })
    expect(screen.getByText(/Pipeline initialised/i)).toBeInTheDocument()
    expect(screen.getByText(/ROGUE AGENT DETECTED/i)).toBeInTheDocument()
    expect(screen.getByText(/Event accepted/i)).toBeInTheDocument()
  })

  it('renders timestamps for each entry', () => {
    renderLog({ entries })
    expect(screen.getByText('10:00:00')).toBeInTheDocument()
  })

  it('renders a Clear button', () => {
    renderLog()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('calls onClear when Clear button is clicked', () => {
    const onClear = vi.fn()
    renderLog({ entries, onClear })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('shows empty state message when no entries', () => {
    renderLog({ entries: [] })
    expect(screen.getByText(/monitoring agent token activity/i)).toBeInTheDocument()
  })
})
