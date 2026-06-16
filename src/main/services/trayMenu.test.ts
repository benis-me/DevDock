import { describe, it, expect, vi } from 'vitest'
import { buildTrayTemplate, runningCount, trayTooltip } from './trayMenu'
import type { Project, SessionState } from '@shared/types'

function project(id: string, name: string, scripts: string[]): Project {
  return {
    id,
    name,
    path: `/tmp/${name}`,
    packageManager: 'npm',
    isMonorepo: false,
    workspaces: [
      {
        name,
        relPath: '.',
        scripts: scripts.map((s) => ({
          id: `.#${s}`,
          name: s,
          command: s,
          kind: s === 'dev' ? 'long-running' : 'one-shot',
          cwd: `/tmp/${name}`
        }))
      }
    ],
    envFiles: [],
    addedAt: 0
  }
}

function session(scriptId: string, status: SessionState['status']): SessionState {
  return { scriptId, pid: 1, status, startedAt: 0 }
}

const noop = { onToggle: () => {}, onStopAll: () => {}, onShow: () => {} }

describe('runningCount / trayTooltip', () => {
  it('counts running and starting only', () => {
    const sessions = [session('a', 'running'), session('b', 'starting'), session('c', 'exited')]
    expect(runningCount(sessions)).toBe(2)
    expect(trayTooltip(sessions)).toBe('DevDock — 2 个脚本运行中')
    expect(trayTooltip([])).toBe('DevDock')
  })
})

describe('buildTrayTemplate', () => {
  it('shows an empty hint when no project has scripts', () => {
    const tmpl = buildTrayTemplate([], [], noop)
    expect(tmpl.some((i) => i.label === '没有可运行的脚本')).toBe(true)
    expect(tmpl.some((i) => i.label === '显示主窗口')).toBe(true)
    expect(tmpl.some((i) => i.role === 'quit')).toBe(true)
  })

  it('lists each project as a submenu of script checkboxes', () => {
    const p = project('p1', 'web', ['dev', 'build'])
    const tmpl = buildTrayTemplate([p], [], noop)
    const entry = tmpl.find((i) => i.label === 'web')
    expect(entry).toBeTruthy()
    const sub = entry!.submenu as { label?: string; type?: string; checked?: boolean }[]
    expect(sub.map((s) => s.label)).toEqual(['dev', 'build'])
    expect(sub.every((s) => s.type === 'checkbox' && s.checked === false)).toBe(true)
  })

  it('marks running scripts checked and the project with a dot', () => {
    const p = project('p1', 'web', ['dev', 'build'])
    const tmpl = buildTrayTemplate([p], [session('p1::.#dev', 'running')], noop)
    const entry = tmpl.find((i) => i.label === '● web')!
    const sub = entry.submenu as { label?: string; checked?: boolean }[]
    expect(sub.find((s) => s.label === 'dev')!.checked).toBe(true)
    expect(sub.find((s) => s.label === 'build')!.checked).toBe(false)
  })

  it('toggle calls start when idle and stop when running', () => {
    const onToggle = vi.fn()
    const p = project('p1', 'web', ['dev'])
    // idle
    let sub = (buildTrayTemplate([p], [], { ...noop, onToggle }).find((i) => i.label === 'web')!
      .submenu as { click?: () => void }[])
    sub[0].click!()
    expect(onToggle).toHaveBeenCalledWith('p1', '.#dev', false)
    // running
    sub = (buildTrayTemplate([p], [session('p1::.#dev', 'running')], { ...noop, onToggle }).find(
      (i) => i.label === '● web'
    )!.submenu as { click?: () => void }[])
    sub[0].click!()
    expect(onToggle).toHaveBeenLastCalledWith('p1', '.#dev', true)
  })

  it('shows 停止全部 only when something is running', () => {
    const p = project('p1', 'web', ['dev'])
    expect(buildTrayTemplate([p], [], noop).some((i) => `${i.label}`.startsWith('停止全部'))).toBe(
      false
    )
    const tmpl = buildTrayTemplate([p], [session('p1::.#dev', 'running')], noop)
    expect(tmpl.some((i) => i.label === '停止全部（1）')).toBe(true)
  })

  it('skips missing projects and those without scripts', () => {
    const ok = project('p1', 'web', ['dev'])
    const empty = project('p2', 'empty', [])
    const missing = { ...project('p3', 'gone', ['dev']), missing: true }
    const tmpl = buildTrayTemplate([ok, empty, missing], [], noop)
    expect(tmpl.some((i) => i.label === 'web')).toBe(true)
    expect(tmpl.some((i) => i.label === 'empty')).toBe(false)
    expect(tmpl.some((i) => i.label === 'gone')).toBe(false)
  })
})
