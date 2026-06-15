import chokidar, { type FSWatcher } from 'chokidar'
import type { Project } from '@shared/types'

export interface IFileWatcher {
  watch(project: Project): void
  unwatch(projectId: string): void
  close(): void
}

const WATCH_NAMES = /(^|[\\/])(package\.json|pnpm-workspace\.yaml|\.env(\..+)?)$/

export class FileWatcher implements IFileWatcher {
  private watchers = new Map<string, FSWatcher>()
  private timers = new Map<string, NodeJS.Timeout>()
  private lastPath = new Map<string, string>()

  constructor(private readonly onChange: (projectId: string, changedPath: string) => void) {}

  watch(project: Project): void {
    this.unwatch(project.id)
    const w = chokidar.watch(project.path, {
      ignored: (p: string) =>
        p.includes('node_modules') ||
        p.includes('.git') ||
        p.includes('.codegraph') ||
        /\.sock$/.test(p),
      ignoreInitial: true,
      depth: 4
    })
    // 吞掉无法监听的路径（套接字、权限等），避免未捕获的 promise 拒绝
    w.on('error', () => {})
    const handler = (p: string): void => {
      if (!WATCH_NAMES.test(p)) return
      this.lastPath.set(project.id, p)
      const existing = this.timers.get(project.id)
      if (existing) clearTimeout(existing)
      this.timers.set(
        project.id,
        setTimeout(() => this.onChange(project.id, this.lastPath.get(project.id) ?? ''), 300)
      )
    }
    w.on('add', handler).on('change', handler).on('unlink', handler)
    this.watchers.set(project.id, w)
  }

  unwatch(projectId: string): void {
    this.watchers.get(projectId)?.close()
    this.watchers.delete(projectId)
    const t = this.timers.get(projectId)
    if (t) clearTimeout(t)
    this.timers.delete(projectId)
    this.lastPath.delete(projectId)
  }

  close(): void {
    for (const w of this.watchers.values()) w.close()
    this.watchers.clear()
    this.timers.clear()
    this.lastPath.clear()
  }
}
