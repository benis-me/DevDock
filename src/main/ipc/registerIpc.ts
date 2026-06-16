import { ipcMain, dialog, shell, nativeTheme, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppController } from '../AppController'
import { detectApps, openWith } from '../services/appLauncher'

export function registerIpc(controller: AppController, getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, ...args: unknown[]): void => {
    getWindow()?.webContents.send(channel, ...args)
  }

  controller.on('terminal:data', (key, chunk) => send(IPC.EvtTerminalData, key, chunk))
  controller.on('session:status', (s) => send(IPC.EvtSessionStatus, s))
  controller.on('session:url', (key, url) => send(IPC.EvtSessionUrl, key, url))
  controller.on('project:updated', (p) => send(IPC.EvtProjectUpdated, p))
  controller.on('script:changed', (key) => send(IPC.EvtScriptChanged, key))
  controller.on('env:changed', (p) => send(IPC.EvtEnvChanged, p))
  controller.on('port:conflict', (key, port) => send(IPC.EvtPortConflict, key, port))

  ipcMain.handle(IPC.ProjectsList, () => controller.listProjects())
  ipcMain.handle(IPC.ProjectsAdd, async () => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    return controller.addProjectFromPath(res.filePaths[0])
  })
  ipcMain.handle(IPC.ProjectsRemove, (_e, id: string) => controller.removeProject(id))
  ipcMain.handle(IPC.ProjectsRename, (_e, id: string, name: string) => controller.renameProject(id, name))
  ipcMain.handle(IPC.ProjectsRescan, (_e, id: string) => controller.rescanProject(id).project)
  ipcMain.handle(IPC.ProjectsRelocate, async (_e, id: string) => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    return controller.relocateProject(id, res.filePaths[0])
  })
  ipcMain.handle(IPC.ProjectsAddPath, (_e, p: string) => controller.addProjectFromPath(p))
  ipcMain.handle(IPC.ProjectsReorder, (_e, ids: string[]) => controller.reorderProjects(ids))
  ipcMain.handle(IPC.ProjectsSetPinned, (_e, id: string, pinned: boolean) =>
    controller.setProjectPinned(id, pinned)
  )

  ipcMain.handle(IPC.ScriptsStart, (_e, pid: string, sid: string) => controller.startScript(pid, sid))
  ipcMain.handle(IPC.ScriptsStop, (_e, key: string) => controller.stopSession(key))
  ipcMain.handle(IPC.ScriptsRestart, (_e, pid: string, sid: string) => controller.restartScript(pid, sid))
  ipcMain.handle(IPC.ScriptsPrefs, () => controller.getScriptPrefs())
  ipcMain.handle(IPC.ScriptsSetPortless, (_e, pid: string, sid: string, enabled: boolean) =>
    controller.setScriptPortless(pid, sid, enabled)
  )
  ipcMain.handle(IPC.PortlessAvailable, () => controller.isPortlessAvailable())

  ipcMain.handle(IPC.TerminalWrite, (_e, key: string, data: string) => controller.writeTerminal(key, data))
  ipcMain.handle(IPC.TerminalResize, (_e, key: string, c: number, r: number) =>
    controller.resizeTerminal(key, c, r)
  )
  ipcMain.handle(IPC.TerminalGetBuffer, (_e, key: string) => controller.getBuffer(key))

  ipcMain.handle(IPC.ShellOpenExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.ShellOpenPath, (_e, p: string) => shell.openPath(p))

  ipcMain.handle(IPC.EnvRead, (_e, p: string) => controller.readEnvFile(p))
  ipcMain.handle(IPC.EnvWrite, (_e, p: string, content: string) => controller.writeEnvFile(p, content))

  ipcMain.handle(IPC.AppsList, () => detectApps())
  ipcMain.handle(IPC.AppsOpenWith, (_e, appId: string, folder: string) => openWith(appId, folder))

  ipcMain.handle(IPC.PortsWho, (_e, port: number) => controller.whoListens(port))
  ipcMain.handle(IPC.PortsKill, (_e, port: number) => controller.killPort(port))
  ipcMain.handle(IPC.PortsKillPid, (_e, pid: number) => controller.killPid(pid))

  ipcMain.handle(IPC.SettingsGet, () => controller.getSettings())
  ipcMain.handle(IPC.SettingsSet, (_e, partial) => controller.setSettings(partial))

  ipcMain.handle(IPC.UiGetState, () => controller.getUiState())
  ipcMain.handle(IPC.UiSetState, (_e, partial) => {
    controller.setUiState(partial)
    if (partial.theme) nativeTheme.themeSource = partial.theme
  })
  ipcMain.handle(IPC.SessionsList, () => controller.listSessions())
}
