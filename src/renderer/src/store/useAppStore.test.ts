// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from './useAppStore'
import type { SessionState } from '@shared/types'

beforeEach(() => {
  useAppStore.setState({ projects: [], sessions: {}, selectedProjectId: undefined, selectedScriptId: undefined, openTabs: [] })
})

describe('useAppStore reducers', () => {
  it('applyStatus stores session by key', () => {
    const s: SessionState = { scriptId: 'p1::.#dev', pid: 9, status: 'running', startedAt: 1 }
    useAppStore.getState().applyStatus(s)
    expect(useAppStore.getState().sessions['p1::.#dev'].status).toBe('running')
  })

  it('applyUrl updates url on existing session', () => {
    useAppStore.getState().applyStatus({ scriptId: 'p1::.#dev', pid: 9, status: 'running', startedAt: 1 })
    useAppStore.getState().applyUrl('p1::.#dev', 'http://localhost:5173/')
    expect(useAppStore.getState().sessions['p1::.#dev'].url).toBe('http://localhost:5173/')
  })

  it('openTab adds unique tabs and sets selection', () => {
    useAppStore.getState().openTab('p1::.#dev')
    useAppStore.getState().openTab('p1::.#dev')
    expect(useAppStore.getState().openTabs).toEqual(['p1::.#dev'])
    expect(useAppStore.getState().selectedScriptId).toBe('p1::.#dev')
  })

  it('closeTab removes tab and clears selection if active', () => {
    useAppStore.getState().openTab('p1::.#dev')
    useAppStore.getState().closeTab('p1::.#dev')
    expect(useAppStore.getState().openTabs).toEqual([])
    expect(useAppStore.getState().selectedScriptId).toBeUndefined()
  })
})
