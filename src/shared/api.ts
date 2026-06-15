import type { Project, SessionState, UiState } from './types'

export interface DevDockApi {
  projects: {
    list(): Promise<Project[]>
    add(): Promise<Project | null>
    remove(id: string): Promise<void>
    rename(id: string, name: string): Promise<void>
    rescan(id: string): Promise<Project | null>
    relocate(id: string): Promise<Project | null>
  }
  scripts: {
    start(projectId: string, scriptId: string): Promise<void>
    stop(sessionKey: string): Promise<void>
    restart(projectId: string, scriptId: string): Promise<void>
  }
  terminal: {
    write(sessionKey: string, data: string): Promise<void>
    resize(sessionKey: string, cols: number, rows: number): Promise<void>
    getBuffer(sessionKey: string): Promise<string>
  }
  shell: {
    openExternal(url: string): Promise<void>
    revealInFinder(path: string): Promise<void>
  }
  ui: {
    getState(): Promise<UiState>
    setState(partial: Partial<UiState>): Promise<void>
  }
  sessions: { list(): Promise<SessionState[]> }
  onTerminalData(cb: (sessionKey: string, chunk: string) => void): () => void
  onSessionStatus(cb: (state: SessionState) => void): () => void
  onSessionUrl(cb: (sessionKey: string, url: string) => void): () => void
  onProjectUpdated(cb: (project: Project) => void): () => void
  onScriptChanged(cb: (sessionKey: string) => void): () => void
}

declare global {
  interface Window {
    devdock: DevDockApi
  }
}
