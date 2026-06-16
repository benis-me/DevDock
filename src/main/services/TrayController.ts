import { Tray, Menu, nativeImage } from 'electron'
import type { AppController } from '../AppController'
import { buildTrayTemplate, trayTooltip } from './trayMenu'
import { TRAY_ICON_PNG_BASE64 } from './trayIcon'

export class TrayController {
  private tray: Tray | null = null
  private rebuildTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly controller: AppController,
    private readonly showWindow: () => void
  ) {}

  init(): void {
    const img = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_PNG_BASE64, 'base64'), {
      scaleFactor: 2
    })
    img.setTemplateImage(true)
    this.tray = new Tray(img)
    this.rebuild()

    const schedule = (): void => this.scheduleRebuild()
    this.controller.on('session:status', schedule)
    this.controller.on('project:updated', schedule)
  }

  // 状态变化常成批到来，合并后再重建一次菜单
  private scheduleRebuild(): void {
    if (this.rebuildTimer) return
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null
      this.rebuild()
    }, 120)
  }

  private rebuild(): void {
    if (!this.tray) return
    const projects = this.controller.listProjects()
    const sessions = this.controller.listSessions()
    const template = buildTrayTemplate(projects, sessions, {
      onToggle: (projectId, scriptId, running) => {
        if (running) this.controller.stopSession(`${projectId}::${scriptId}`)
        else this.controller.startScript(projectId, scriptId)
      },
      onStopAll: () => {
        for (const s of this.controller.listSessions()) {
          if (s.status === 'running' || s.status === 'starting') this.controller.stopSession(s.scriptId)
        }
      },
      onShow: () => this.showWindow()
    })
    this.tray.setToolTip(trayTooltip(sessions))
    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  destroy(): void {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer)
    this.tray?.destroy()
    this.tray = null
  }
}
