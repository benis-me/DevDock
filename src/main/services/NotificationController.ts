import { Notification } from 'electron'
import type { AppController } from '../AppController'
import type { ScriptKind, SessionState, SessionStatus } from '@shared/types'
import { notifyDecision } from './notify'

// 把 sessionKey(`projectId::scriptId`) 还原成可读名字 + 脚本类型
function describe(
  controller: AppController,
  key: string
): { kind: ScriptKind | undefined; label: string } {
  const [projectId, scriptId] = key.split('::')
  const project = controller.listProjects().find((p) => p.id === projectId)
  if (!project) return { kind: undefined, label: scriptId }
  for (const ws of project.workspaces) {
    const def = ws.scripts.find((s) => s.id === scriptId)
    if (def) return { kind: def.kind, label: `${project.name} · ${def.name}` }
  }
  return { kind: undefined, label: `${project.name} · ${scriptId}` }
}

export class NotificationController {
  private last = new Map<string, SessionStatus>()

  constructor(
    private readonly controller: AppController,
    private readonly isWindowFocused: () => boolean,
    private readonly showWindow: () => void
  ) {}

  init(): void {
    this.controller.on('session:status', (s: SessionState) => this.handle(s))
  }

  private handle(s: SessionState): void {
    const prev = this.last.get(s.scriptId)
    this.last.set(s.scriptId, s.status)

    if (!this.controller.getSettings().notifyOnFinish) return
    if (!Notification.isSupported()) return
    // 用户正盯着窗口时不打扰
    if (this.isWindowFocused()) return

    const { kind, label } = describe(this.controller, s.scriptId)
    const decision = notifyDecision(prev, s, kind)
    if (!decision) return

    const n = new Notification({ title: decision.title, body: label, silent: false })
    n.on('click', () => this.showWindow())
    n.show()
  }
}
