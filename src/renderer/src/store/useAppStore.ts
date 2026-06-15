import { create } from 'zustand'
import type { Project, SessionState, ThemeMode } from '@shared/types'
import { sessionKey } from '@shared/util'

interface AppState {
  projects: Project[]
  sessions: Record<string, SessionState>
  selectedProjectId?: string
  selectedScriptId?: string // sessionKey of focused terminal tab
  openTabs: string[] // sessionKeys
  theme: ThemeMode

  init(): Promise<void>
  selectProject(id: string): void
  addProject(): Promise<void>
  removeProject(id: string): Promise<void>
  renameProject(id: string, name: string): Promise<void>
  rescanProject(id: string): Promise<void>
  relocateProject(id: string): Promise<void>
  startScript(projectId: string, scriptId: string): Promise<void>
  stopScript(key: string): Promise<void>
  restartScript(projectId: string, scriptId: string): Promise<void>
  openTab(key: string): void
  closeTab(key: string): void
  setTheme(theme: ThemeMode): Promise<void>
  applyThemeClass(): void

  applyStatus(s: SessionState): void
  applyUrl(key: string, url: string): void
  applyProjectUpdated(p: Project): void
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  sessions: {},
  openTabs: [],
  theme: 'system',

  async init() {
    const [projects, ui, sessions] = await Promise.all([
      window.devdock.projects.list(),
      window.devdock.ui.getState(),
      window.devdock.sessions.list()
    ])
    const sessMap: Record<string, SessionState> = {}
    for (const s of sessions) sessMap[s.scriptId] = s
    set({
      projects,
      sessions: sessMap,
      theme: ui.theme,
      selectedProjectId: ui.selectedProjectId ?? projects[0]?.id
    })
    get().applyThemeClass()

    window.devdock.onSessionStatus((s) => {
      get().applyStatus(s)
      if (s.status === 'errored') {
        import('sonner').then(({ toast }) =>
          toast.error('脚本运行出错', { description: s.scriptId.split('::')[1] })
        )
      }
    })
    window.devdock.onSessionUrl((key, url) => get().applyUrl(key, url))
    window.devdock.onProjectUpdated((p) => get().applyProjectUpdated(p))

    window.devdock.onScriptChanged((key) => {
      const [projectId, scriptId] = key.split('::')
      // 动态导入 toast，避免在测试 node 环境下加载 UI
      import('sonner').then(({ toast }) => {
        toast('脚本定义已更新', {
          description: scriptId,
          action: {
            label: '重启',
            onClick: () => get().restartScript(projectId, scriptId)
          }
        })
      })
    })

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', () => {
      if (get().theme === 'system') get().applyThemeClass()
    })
  },

  selectProject(id) {
    set({ selectedProjectId: id })
    window.devdock.ui.setState({ selectedProjectId: id })
  },

  async addProject() {
    const p = await window.devdock.projects.add()
    if (p) {
      set((st) => ({ projects: [...st.projects, p], selectedProjectId: p.id }))
      window.devdock.ui.setState({ selectedProjectId: p.id })
    }
  },

  async removeProject(id) {
    await window.devdock.projects.remove(id)
    set((st) => {
      const projects = st.projects.filter((p) => p.id !== id)
      return {
        projects,
        selectedProjectId: st.selectedProjectId === id ? projects[0]?.id : st.selectedProjectId
      }
    })
  },

  async renameProject(id, name) {
    await window.devdock.projects.rename(id, name)
    set((st) => ({ projects: st.projects.map((p) => (p.id === id ? { ...p, name } : p)) }))
  },

  async rescanProject(id) {
    const p = await window.devdock.projects.rescan(id)
    if (p) get().applyProjectUpdated(p)
  },

  async relocateProject(id) {
    const p = await window.devdock.projects.relocate(id)
    if (p) get().applyProjectUpdated(p)
  },

  async startScript(projectId, scriptId) {
    const key = sessionKey(projectId, scriptId)
    get().openTab(key)
    await window.devdock.scripts.start(projectId, scriptId)
  },

  async stopScript(key) {
    await window.devdock.scripts.stop(key)
  },

  async restartScript(projectId, scriptId) {
    const key = sessionKey(projectId, scriptId)
    get().openTab(key)
    await window.devdock.scripts.restart(projectId, scriptId)
  },

  openTab(key) {
    set((st) => ({
      openTabs: st.openTabs.includes(key) ? st.openTabs : [...st.openTabs, key],
      selectedScriptId: key
    }))
  },

  closeTab(key) {
    set((st) => {
      const openTabs = st.openTabs.filter((k) => k !== key)
      return {
        openTabs,
        selectedScriptId:
          st.selectedScriptId === key ? openTabs[openTabs.length - 1] : st.selectedScriptId
      }
    })
  },

  async setTheme(theme) {
    set({ theme })
    await window.devdock.ui.setState({ theme })
    get().applyThemeClass()
  },

  applyThemeClass() {
    const { theme } = get()
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  },

  applyStatus(s) {
    set((st) => ({ sessions: { ...st.sessions, [s.scriptId]: s } }))
  },

  applyUrl(key, url) {
    set((st) => {
      const sess = st.sessions[key]
      if (!sess) return {}
      return { sessions: { ...st.sessions, [key]: { ...sess, url } } }
    })
  },

  applyProjectUpdated(p) {
    set((st) => ({ projects: st.projects.map((x) => (x.id === p.id ? p : x)) }))
  }
}))
