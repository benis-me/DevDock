import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '@shared/ipc'
import type { DevDockApi } from '@shared/api'

function sub(channel: string, cb: (...args: any[]) => void): () => void {
  const listener = (_e: unknown, ...args: any[]): void => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: DevDockApi = {
  projects: {
    list: () => ipcRenderer.invoke(IPC.ProjectsList),
    add: () => ipcRenderer.invoke(IPC.ProjectsAdd),
    remove: (id) => ipcRenderer.invoke(IPC.ProjectsRemove, id),
    rename: (id, name) => ipcRenderer.invoke(IPC.ProjectsRename, id, name),
    rescan: (id) => ipcRenderer.invoke(IPC.ProjectsRescan, id),
    relocate: (id) => ipcRenderer.invoke(IPC.ProjectsRelocate, id),
    addPath: (p) => ipcRenderer.invoke(IPC.ProjectsAddPath, p),
    reorder: (ids) => ipcRenderer.invoke(IPC.ProjectsReorder, ids),
    setPinned: (id, pinned) => ipcRenderer.invoke(IPC.ProjectsSetPinned, id, pinned)
  },
  scripts: {
    start: (pid, sid) => ipcRenderer.invoke(IPC.ScriptsStart, pid, sid),
    stop: (key) => ipcRenderer.invoke(IPC.ScriptsStop, key),
    restart: (pid, sid) => ipcRenderer.invoke(IPC.ScriptsRestart, pid, sid),
    prefs: () => ipcRenderer.invoke(IPC.ScriptsPrefs),
    setPortless: (pid, sid, enabled) => ipcRenderer.invoke(IPC.ScriptsSetPortless, pid, sid, enabled),
    portlessAvailable: () => ipcRenderer.invoke(IPC.PortlessAvailable)
  },
  terminal: {
    write: (key, data) => ipcRenderer.invoke(IPC.TerminalWrite, key, data),
    resize: (key, c, r) => ipcRenderer.invoke(IPC.TerminalResize, key, c, r),
    getBuffer: (key) => ipcRenderer.invoke(IPC.TerminalGetBuffer, key),
    clear: (key) => ipcRenderer.invoke(IPC.TerminalClear, key)
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
    openPath: (p) => ipcRenderer.invoke(IPC.ShellOpenPath, p)
  },
  env: {
    read: (p) => ipcRenderer.invoke(IPC.EnvRead, p),
    write: (p, content) => ipcRenderer.invoke(IPC.EnvWrite, p, content)
  },
  apps: {
    list: () => ipcRenderer.invoke(IPC.AppsList),
    openWith: (appId, p) => ipcRenderer.invoke(IPC.AppsOpenWith, appId, p)
  },
  ports: {
    who: (port) => ipcRenderer.invoke(IPC.PortsWho, port),
    kill: (port) => ipcRenderer.invoke(IPC.PortsKill, port),
    killPid: (pid) => ipcRenderer.invoke(IPC.PortsKillPid, pid)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.SettingsGet),
    set: (partial) => ipcRenderer.invoke(IPC.SettingsSet, partial)
  },
  git: {
    statusAll: () => ipcRenderer.invoke(IPC.GitStatusAll)
  },
  win: {
    minimize: () => ipcRenderer.invoke(IPC.WindowMinimize),
    maximize: () => ipcRenderer.invoke(IPC.WindowMaximize),
    close: () => ipcRenderer.invoke(IPC.WindowClose)
  },
  ui: {
    getState: () => ipcRenderer.invoke(IPC.UiGetState),
    setState: (partial) => ipcRenderer.invoke(IPC.UiSetState, partial)
  },
  sessions: { list: () => ipcRenderer.invoke(IPC.SessionsList) },
  versions: {
    electron: process.versions.electron ?? '',
    node: process.versions.node ?? '',
    chrome: process.versions.chrome ?? ''
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  onTerminalData: (cb) => sub(IPC.EvtTerminalData, cb),
  onSessionStatus: (cb) => sub(IPC.EvtSessionStatus, cb),
  onSessionUrl: (cb) => sub(IPC.EvtSessionUrl, cb),
  onProjectUpdated: (cb) => sub(IPC.EvtProjectUpdated, cb),
  onScriptChanged: (cb) => sub(IPC.EvtScriptChanged, cb),
  onEnvChanged: (cb) => sub(IPC.EvtEnvChanged, cb),
  onPortConflict: (cb) => sub(IPC.EvtPortConflict, cb),
  onGitStatus: (cb) => sub(IPC.EvtGitStatus, cb)
}

contextBridge.exposeInMainWorld('devdock', api)
