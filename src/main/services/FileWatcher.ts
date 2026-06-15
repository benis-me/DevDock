import chokidar, { type FSWatcher } from 'chokidar'
import type { Project } from '@shared/types'

export interface IFileWatcher {
  watch(project: Project): void
  unwatch(projectId: string): void
  close(): void
}

const WATCH_NAMES = /(^|[\\/])(package\.json|pnpm-workspace\.yaml)$/

export class FileWatcher implements IFileWatcher {
  private watchers = new Map<string, FSWatcher>()
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly onChange: (projectId: string) => void) {}

  watch(project: Project): void {
    this.unwatch(project.id)
    const w = chokidar.watch(project.path, {
      ignored: (p: string) => p.includes('node_modules') || p.includes('.git'),
      ignoreInitial: true,
      depth: 4
    })
    const handler = (p: string): void => {
      if (!WATCH_NAMES.test(p)) return
      const existing = this.timers.get(project.id)
      if (existing) clearTimeout(existing)
      this.timers.set(
        project.id,
        setTimeout(() => this.onChange(project.id), 300)
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
  }

  close(): void {
    for (const w of this.watchers.values()) w.close()
    this.watchers.clear()
    this.timers.clear()
  }
}
