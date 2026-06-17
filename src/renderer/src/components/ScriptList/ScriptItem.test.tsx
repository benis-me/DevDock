// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptItem } from './ScriptItem'
import { useAppStore } from '@/store/useAppStore'
import type { ScriptDef } from '@shared/types'

const def: ScriptDef = { id: '.#dev', name: 'dev', command: 'vite', kind: 'long-running', cwd: '/x' }

beforeEach(() => {
  ;(globalThis as any).window.devdock = {
    scripts: { start: vi.fn(), stop: vi.fn(), restart: vi.fn() },
    shell: { openExternal: vi.fn() }
  }
  useAppStore.setState({ sessions: {}, selectedProjectId: 'p1' })
})

describe('ScriptItem', () => {
  it('shows command and a start affordance when stopped', () => {
    render(<ScriptItem projectId="p1" def={def} />)
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(screen.getByText('vite')).toBeInTheDocument()
    expect(screen.getByTitle('在应用内启动')).toBeInTheDocument()
  })

  it('shows PID, url and stop affordance when running', () => {
    useAppStore.setState({
      sessions: { 'p1::.#dev': { scriptId: 'p1::.#dev', pid: 321, status: 'running', startedAt: Date.now(), url: 'http://localhost:5173/' } }
    })
    render(<ScriptItem projectId="p1" def={def} />)
    expect(screen.getByText(/321/)).toBeInTheDocument()
    expect(screen.getByText('http://localhost:5173/')).toBeInTheDocument()
    expect(screen.getByTitle('停止')).toBeInTheDocument()
  })
})
