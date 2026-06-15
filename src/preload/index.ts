import { contextBridge, ipcRenderer } from 'electron'
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
    relocate: (id) => ipcRenderer.invoke(IPC.ProjectsRelocate, id)
  },
  scripts: {
    start: (pid, sid) => ipcRenderer.invoke(IPC.ScriptsStart, pid, sid),
    stop: (key) => ipcRenderer.invoke(IPC.ScriptsStop, key),
    restart: (pid, sid) => ipcRenderer.invoke(IPC.ScriptsRestart, pid, sid)
  },
  terminal: {
    write: (key, data) => ipcRenderer.invoke(IPC.TerminalWrite, key, data),
    resize: (key, c, r) => ipcRenderer.invoke(IPC.TerminalResize, key, c, r),
    getBuffer: (key) => ipcRenderer.invoke(IPC.TerminalGetBuffer, key)
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC.ShellOpenExternal, url),
    openPath: (p) => ipcRenderer.invoke(IPC.ShellOpenPath, p)
  },
  env: {
    read: (p) => ipcRenderer.invoke(IPC.EnvRead, p),
    write: (p, content) => ipcRenderer.invoke(IPC.EnvWrite, p, content)
  },
  ui: {
    getState: () => ipcRenderer.invoke(IPC.UiGetState),
    setState: (partial) => ipcRenderer.invoke(IPC.UiSetState, partial)
  },
  sessions: { list: () => ipcRenderer.invoke(IPC.SessionsList) },
  onTerminalData: (cb) => sub(IPC.EvtTerminalData, cb),
  onSessionStatus: (cb) => sub(IPC.EvtSessionStatus, cb),
  onSessionUrl: (cb) => sub(IPC.EvtSessionUrl, cb),
  onProjectUpdated: (cb) => sub(IPC.EvtProjectUpdated, cb),
  onScriptChanged: (cb) => sub(IPC.EvtScriptChanged, cb),
  onEnvChanged: (cb) => sub(IPC.EvtEnvChanged, cb)
}

contextBridge.exposeInMainWorld('devdock', api)
