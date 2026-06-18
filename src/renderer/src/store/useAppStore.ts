import { create } from 'zustand'
import type {
  AppInfo,
  GitInfo,
  Project,
  ScriptPrefs,
  SessionState,
  Settings,
  ThemeMode
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { sessionKey } from '@shared/util'

interface AppState {
  projects: Project[]
  sessions: Record<string, SessionState>
  selectedProjectId?: string
  selectedScriptId?: string // sessionKey of focused terminal tab
  openTabs: string[] // terminal sessionKeys
  openEnvPaths: string[] // open .env editor tabs (absolute paths)
  activeEnvPath?: string // when set, the env tab is the active right-panel tab
  scriptPrefs: Record<string, ScriptPrefs> // key: sessionKey
  portlessAvailable: boolean
  apps: AppInfo[]
  openWithDefault?: string
  theme: ThemeMode
  isDark: boolean // 当前生效的明暗（system 已解析）
  settings: Settings
  gitStatuses: Record<string, GitInfo | null>

  init(): Promise<void>
  selectProject(id: string): void
  addProject(): Promise<void>
  addProjectByPath(path: string): Promise<void>
  removeProject(id: string): Promise<void>
  renameProject(id: string, name: string): Promise<void>
  rescanProject(id: string): Promise<void>
  relocateProject(id: string): Promise<void>
  reorderProjects(orderedIds: string[]): void
  setPinned(id: string, pinned: boolean): Promise<void>
  openWith(appId: string, path: string): Promise<void>
  startScript(projectId: string, scriptId: string): Promise<void>
  runInTerminal(projectId: string, scriptId: string, appId: string): Promise<void>
  stopScript(key: string): Promise<void>
  restartScript(projectId: string, scriptId: string): Promise<void>
  startAllServices(projectId: string): Promise<void>
  stopAllInProject(projectId: string): Promise<void>
  openTab(key: string): void
  closeTab(key: string): void
  openEnvFile(path: string): void
  closeEnv(path: string): void
  reorderTabs(orderedKeys: string[]): void
  reorderEnvTabs(orderedPaths: string[]): void
  setPortless(projectId: string, scriptId: string, enabled: boolean): Promise<void>
  setScriptPinned(projectId: string, scriptId: string, pinned: boolean): Promise<void>
  killPort(port: number): Promise<number[]>
  freePortAndRestart(projectId: string, scriptId: string, port: number): Promise<void>
  setSettings(partial: Partial<Settings>): Promise<void>
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
  openEnvPaths: [],
  scriptPrefs: {},
  portlessAvailable: false,
  apps: [],
  theme: 'system',
  isDark: false,
  settings: { ...DEFAULT_SETTINGS },
  gitStatuses: {},

  async init() {
    const [projects, ui, sessions, scriptPrefs, portlessAvailable, apps, settings, gitStatuses] =
      await Promise.all([
        window.devdock.projects.list(),
        window.devdock.ui.getState(),
        window.devdock.sessions.list(),
        window.devdock.scripts.prefs(),
        window.devdock.scripts.portlessAvailable(),
        window.devdock.apps.list(),
        window.devdock.settings.get(),
        window.devdock.git.statusAll()
      ])
    const sessMap: Record<string, SessionState> = {}
    for (const s of sessions) sessMap[s.scriptId] = s
    set({
      projects,
      sessions: sessMap,
      scriptPrefs,
      portlessAvailable,
      apps,
      settings,
      gitStatuses,
      openWithDefault: ui.openWithDefault,
      theme: ui.theme,
      selectedProjectId: ui.selectedProjectId ?? projects[0]?.id,
      // restore open tabs from last session
      openTabs: ui.openTabs ?? [],
      openEnvPaths: ui.openEnvPaths ?? [],
      activeEnvPath: ui.activeEnvPath,
      selectedScriptId: ui.selectedScriptId
    })
    get().applyThemeClass()

    // persist open tabs across restarts (debounced by signature)
    let lastSig = ''
    useAppStore.subscribe((s) => {
      const sig = JSON.stringify([s.openTabs, s.openEnvPaths, s.activeEnvPath, s.selectedScriptId])
      if (sig === lastSig) return
      lastSig = sig
      window.devdock.ui.setState({
        openTabs: s.openTabs,
        openEnvPaths: s.openEnvPaths,
        activeEnvPath: s.activeEnvPath,
        selectedScriptId: s.selectedScriptId
      })
    })

    // 端口冲突最近告警过的会话 key —— 避免再叠加一条通用"运行出错"
    const conflicted = new Set<string>()
    window.devdock.onPortConflict(async (key, port) => {
      conflicted.add(key)
      setTimeout(() => conflicted.delete(key), 4000)
      const [projectId, scriptId] = key.split('::')
      // 查清是谁占用了端口，让提示能给出明确信息 + 一键解决
      const holders = await window.devdock.ports.who(port).catch(() => [])
      const description = holders.length
        ? `被 ${holders.map((h) => `${h.command} (PID ${h.pid})`).join('、')} 占用`
        : scriptId
      const { toast } = await import('sonner')
      toast.error(`端口 ${port} 被占用`, {
        description,
        duration: Infinity,
        action: {
          label: '释放并重启',
          onClick: () => get().freePortAndRestart(projectId, scriptId, port)
        }
      })
    })

    window.devdock.onSessionStatus((s) => {
      get().applyStatus(s)
      if (s.status === 'errored' && !conflicted.has(s.scriptId)) {
        import('sonner').then(({ toast }) =>
          toast.error('脚本运行出错', { description: s.scriptId.split('::')[1] })
        )
      }
    })
    window.devdock.onSessionUrl((key, url) => get().applyUrl(key, url))
    window.devdock.onProjectUpdated((p) => get().applyProjectUpdated(p))
    window.devdock.onGitStatus((id, info) =>
      set((st) => ({ gitStatuses: { ...st.gitStatuses, [id]: info } }))
    )

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
    const tabs = get().openTabs.filter((k) => k.startsWith(id + '::'))
    set({ selectedProjectId: id, selectedScriptId: tabs[tabs.length - 1], activeEnvPath: undefined })
    window.devdock.ui.setState({ selectedProjectId: id })
  },

  async addProject() {
    const p = await window.devdock.projects.add()
    if (p) {
      set((st) => ({
        projects: st.projects.some((x) => x.id === p.id) ? st.projects : [...st.projects, p],
        selectedProjectId: p.id
      }))
      window.devdock.ui.setState({ selectedProjectId: p.id })
    }
  },

  async addProjectByPath(path) {
    const p = await window.devdock.projects.addPath(path)
    if (p) {
      set((st) => ({
        projects: st.projects.some((x) => x.id === p.id) ? st.projects : [...st.projects, p],
        selectedProjectId: p.id,
        activeEnvPath: undefined
      }))
      window.devdock.ui.setState({ selectedProjectId: p.id })
    }
  },

  reorderProjects(orderedIds) {
    set((st) => {
      const byId = new Map(st.projects.map((p) => [p.id, p]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((p): p is Project => p !== undefined)
      for (const p of st.projects) if (!orderedIds.includes(p.id)) next.push(p)
      return { projects: next }
    })
    window.devdock.projects.reorder(orderedIds)
  },

  async setPinned(id, pinned) {
    set((st) => ({
      projects: st.projects.map((p) => (p.id === id ? { ...p, pinned } : p))
    }))
    await window.devdock.projects.setPinned(id, pinned)
  },

  async openWith(appId, path) {
    set({ openWithDefault: appId })
    window.devdock.ui.setState({ openWithDefault: appId })
    await window.devdock.apps.openWith(appId, path)
  },

  async removeProject(id) {
    await window.devdock.projects.remove(id)
    set((st) => {
      const removed = st.projects.find((p) => p.id === id)
      const projects = st.projects.filter((p) => p.id !== id)
      const openTabs = st.openTabs.filter((k) => !k.startsWith(id + '::'))
      const openEnvPaths = removed
        ? st.openEnvPaths.filter((p) => !p.startsWith(removed.path))
        : st.openEnvPaths
      const selectedProjectId =
        st.selectedProjectId === id ? projects[0]?.id : st.selectedProjectId
      const projectTabs = selectedProjectId
        ? openTabs.filter((k) => k.startsWith(selectedProjectId + '::'))
        : []
      const activeEnvPath =
        removed && st.activeEnvPath?.startsWith(removed.path) ? undefined : st.activeEnvPath
      return {
        projects,
        openTabs,
        openEnvPaths,
        selectedProjectId,
        selectedScriptId: projectTabs.at(-1),
        activeEnvPath
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

  async runInTerminal(projectId, scriptId, appId) {
    await window.devdock.scripts.runInTerminal(projectId, scriptId, appId)
  },

  async stopScript(key) {
    await window.devdock.scripts.stop(key)
  },

  async restartScript(projectId, scriptId) {
    const key = sessionKey(projectId, scriptId)
    get().openTab(key)
    await window.devdock.scripts.restart(projectId, scriptId)
  },

  async startAllServices(projectId) {
    const p = get().projects.find((x) => x.id === projectId)
    if (!p) return
    for (const ws of p.workspaces) {
      for (const def of ws.scripts) {
        if (def.kind !== 'long-running') continue
        const st = get().sessions[sessionKey(projectId, def.id)]?.status
        if (st === 'running' || st === 'starting') continue
        await get().startScript(projectId, def.id)
      }
    }
  },

  async stopAllInProject(projectId) {
    const prefix = projectId + '::'
    for (const [key, s] of Object.entries(get().sessions)) {
      if (key.startsWith(prefix) && (s.status === 'running' || s.status === 'starting')) {
        await get().stopScript(key)
      }
    }
  },

  openTab(key) {
    set((st) => ({
      openTabs: st.openTabs.includes(key) ? st.openTabs : [...st.openTabs, key],
      selectedScriptId: key,
      activeEnvPath: undefined
    }))
  },

  openEnvFile(path) {
    set((st) => ({
      openEnvPaths: st.openEnvPaths.includes(path) ? st.openEnvPaths : [...st.openEnvPaths, path],
      activeEnvPath: path
    }))
  },

  closeEnv(path) {
    set((st) => ({
      openEnvPaths: st.openEnvPaths.filter((p) => p !== path),
      activeEnvPath: st.activeEnvPath === path ? undefined : st.activeEnvPath
    }))
  },

  async setPortless(projectId, scriptId, enabled) {
    const key = sessionKey(projectId, scriptId)
    set((st) => ({
      scriptPrefs: { ...st.scriptPrefs, [key]: { ...st.scriptPrefs[key], portless: enabled } }
    }))
    await window.devdock.scripts.setPortless(projectId, scriptId, enabled)
  },

  async setScriptPinned(projectId, scriptId, pinned) {
    const key = sessionKey(projectId, scriptId)
    set((st) => ({
      scriptPrefs: { ...st.scriptPrefs, [key]: { ...st.scriptPrefs[key], pinned } }
    }))
    await window.devdock.scripts.setPinned(projectId, scriptId, pinned)
  },

  async killPort(port) {
    return window.devdock.ports.kill(port)
  },

  async freePortAndRestart(projectId, scriptId, port) {
    await window.devdock.ports.kill(port)
    await get().restartScript(projectId, scriptId)
  },

  async setSettings(partial) {
    set((st) => ({ settings: { ...st.settings, ...partial } }))
    const next = await window.devdock.settings.set(partial)
    set({ settings: next })
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

  // 把某项目内重排后的 tab 顺序写回全局 openTabs（只动属于该子集的槽位，其它项目顺序不变）
  reorderTabs(orderedKeys) {
    set((st) => {
      const inSet = new Set(orderedKeys)
      let i = 0
      return { openTabs: st.openTabs.map((k) => (inSet.has(k) ? orderedKeys[i++] : k)) }
    })
  },

  reorderEnvTabs(orderedPaths) {
    set((st) => {
      const inSet = new Set(orderedPaths)
      let i = 0
      return { openEnvPaths: st.openEnvPaths.map((p) => (inSet.has(p) ? orderedPaths[i++] : p)) }
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
    set({ isDark })
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
