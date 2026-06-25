// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptList } from './ScriptList'
import { useAppStore } from '@/store/useAppStore'
import type { Project, ScriptDef } from '@shared/types'

function mkScript(name: string): ScriptDef {
  return { id: `.#${name}`, name, command: `run ${name}`, kind: 'one-shot', cwd: '/x' }
}
function proj(id: string, isMonorepo: boolean, scripts: string[]): Project {
  return {
    id,
    name: id,
    path: '/x',
    packageManager: 'npm',
    isMonorepo,
    workspaces: [{ name: id, relPath: '.', scripts: scripts.map(mkScript) }],
    envFiles: [],
    addedAt: 0
  }
}

beforeEach(() => {
  ;(globalThis as any).window.devdock = { scripts: {}, shell: {} }
  useAppStore.setState({ sessions: {}, scriptPrefs: {}, apps: [] })
  localStorage.clear()
})

describe('ScriptList collapse isolation', () => {
  it('does not leak a collapsed root workspace across projects (key is project-scoped)', () => {
    // 项目 A（monorepo）的根 workspace 处于折叠态
    localStorage.setItem('devdock:ws-collapsed:A:.', '1')
    const { rerender } = render(<ScriptList project={proj('A', true, ['abuild'])} />)
    // 切到 B（单包，同 relPath '.'）：不能复用 A 的 WorkspaceBlock、继承其折叠态
    rerender(<ScriptList project={proj('B', false, ['bdev'])} />)
    expect(screen.getByText('bdev')).toBeInTheDocument()
  })

  it('a non-monorepo workspace always shows scripts even with a stale collapse flag', () => {
    localStorage.setItem('devdock:ws-collapsed:C:.', '1')
    render(<ScriptList project={proj('C', false, ['cdev'])} />)
    expect(screen.getByText('cdev')).toBeInTheDocument()
  })
})
