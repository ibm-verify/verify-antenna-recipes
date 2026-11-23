import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'

// ── State shape ──────────────────────────────────────────────────────────────
const initialState = {
  logEntries:     [],   // [{ id, ts, level, msg }]
  streamRecords:  [],   // [TransformRecord] from SSE log tail
  pipelineStatus: {     // which node is active
    vip:    false,
    tx:     false,
    rx:     false,
    action: false,
  },
  packetActive: {       // which packet is animating
    pkt1: false,
    pkt2: false,
    pkt3: false,
  },
  actionCount:    0,
  isRunning:      false,
  ssfEvents:      [],   // raw SSF SET objects received/produced
  theme:          'dark',  // 'dark' | 'light'
}

// ── Actions ──────────────────────────────────────────────────────────────────
export const Actions = {
  LOG:                'LOG',
  CLEAR_LOG:          'CLEAR_LOG',
  SET_RUNNING:        'SET_RUNNING',
  SET_NODE_ACTIVE:    'SET_NODE_ACTIVE',
  SET_PACKET_ACTIVE:  'SET_PACKET_ACTIVE',
  INCREMENT_COUNT:    'INCREMENT_COUNT',
  ADD_SSF_EVENT:      'ADD_SSF_EVENT',
  ADD_STREAM_RECORD:  'ADD_STREAM_RECORD',
  TOGGLE_THEME:       'TOGGLE_THEME',
}

function reducer(state, { type, payload }) {
  switch (type) {
    case Actions.LOG:
      return { ...state, logEntries: [...state.logEntries, payload] }

    case Actions.CLEAR_LOG:
      return { ...state, logEntries: [] }

    case Actions.SET_RUNNING:
      return { ...state, isRunning: payload }

    case Actions.SET_NODE_ACTIVE:
      return {
        ...state,
        pipelineStatus: { ...state.pipelineStatus, [payload.node]: payload.active }
      }

    case Actions.SET_PACKET_ACTIVE:
      return {
        ...state,
        packetActive: { ...state.packetActive, [payload.pkt]: payload.active }
      }

    case Actions.INCREMENT_COUNT:
      return { ...state, actionCount: state.actionCount + 1 }

    case Actions.ADD_SSF_EVENT:
      return { ...state, ssfEvents: [payload, ...state.ssfEvents] }

    case Actions.ADD_STREAM_RECORD: {
      // Update existing record (same id) or prepend new one
      const existing = state.streamRecords.findIndex(r => r.id === payload.id)
      if (existing >= 0) {
        const updated = [...state.streamRecords]
        updated[existing] = { ...updated[existing], ...payload }
        return { ...state, streamRecords: updated }
      }
      return { ...state, streamRecords: [payload, ...state.streamRecords] }
    }

    case Actions.TOGGLE_THEME:
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }

    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Apply theme class to <html> element whenever theme changes
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', state.theme)
  }, [state.theme])

  const log = useCallback((level, msg) => {
    const now = new Date()
    const ts  = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':')
    dispatch({
      type:    Actions.LOG,
      payload: { id: `${Date.now()}-${Math.random()}`, ts, level, msg }
    })
  }, [])

  const clearLog = useCallback(() => dispatch({ type: Actions.CLEAR_LOG }), [])

  const setNodeActive = useCallback((node, active, ms = 3500) => {
    dispatch({ type: Actions.SET_NODE_ACTIVE, payload: { node, active: true } })
    setTimeout(() => {
      dispatch({ type: Actions.SET_NODE_ACTIVE, payload: { node, active: false } })
    }, ms)
  }, [])

  const animatePacket = useCallback((pkt) => {
    return new Promise(resolve => {
      dispatch({ type: Actions.SET_PACKET_ACTIVE, payload: { pkt, active: true } })
      setTimeout(() => {
        dispatch({ type: Actions.SET_PACKET_ACTIVE, payload: { pkt, active: false } })
        resolve()
      }, 2000)
    })
  }, [])

  const toggleTheme = useCallback(() => dispatch({ type: Actions.TOGGLE_THEME }), [])

  return (
    <AppContext.Provider value={{ state, dispatch, log, clearLog, setNodeActive, animatePacket, toggleTheme }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
