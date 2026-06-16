import type { MenuItemConstructorOptions } from 'electron'
import type { Project, SessionState } from '@shared/types'
import { sessionKey } from '@shared/util'

export interface TrayActions {
  onToggle(projectId: string, scriptId: string, running: boolean): void
  onStopAll(): void
  onShow(): void
}

const isLive = (s?: SessionState): boolean => s?.status === 'running' || s?.status === 'starting'

export function runningCount(sessions: SessionState[]): number {
  return sessions.filter((s) => isLive(s)).length
}

export function trayTooltip(sessions: SessionState[]): string {
  const n = runningCount(sessions)
  return n > 0 ? `DevDock — ${n} 个脚本运行中` : 'DevDock'
}

// 构造托盘右键菜单模板（纯函数，便于测试；运行时由 TrayController 交给 electron）
export function buildTrayTemplate(
  projects: Project[],
  sessions: SessionState[],
  actions: TrayActions
): MenuItemConstructorOptions[] {
  const byKey = new Map(sessions.map((s) => [s.scriptId, s]))
  const live = (key: string): boolean => isLive(byKey.get(key))

  const tmpl: MenuItemConstructorOptions[] = [
    { label: 'DevDock', enabled: false },
    { type: 'separator' }
  ]

  const usable = projects.filter(
    (p) => !p.missing && p.workspaces.some((w) => w.scripts.length > 0)
  )

  if (usable.length === 0) {
    tmpl.push({ label: '没有可运行的脚本', enabled: false })
  } else {
    for (const p of usable) {
      const sub: MenuItemConstructorOptions[] = []
      for (const ws of p.workspaces) {
        for (const def of ws.scripts) {
          const key = sessionKey(p.id, def.id)
          const running = live(key)
          sub.push({
            label: def.name,
            type: 'checkbox',
            checked: running,
            click: () => actions.onToggle(p.id, def.id, running)
          })
        }
      }
      const anyRunning = p.workspaces.some((w) =>
        w.scripts.some((d) => live(sessionKey(p.id, d.id)))
      )
      tmpl.push({ label: anyRunning ? `● ${p.name}` : p.name, submenu: sub })
    }
  }

  const count = runningCount(sessions)
  tmpl.push({ type: 'separator' })
  if (count > 0) tmpl.push({ label: `停止全部（${count}）`, click: () => actions.onStopAll() })
  tmpl.push({ label: '显示主窗口', click: () => actions.onShow() })
  tmpl.push({ type: 'separator' })
  tmpl.push({ label: '退出 DevDock', role: 'quit' })

  return tmpl
}
