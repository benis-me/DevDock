import { ipcMain, dialog, shell, nativeTheme, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppController } from '../AppController'

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

  ipcMain.handle(IPC.ScriptsStart, (_e, pid: string, sid: string) => controller.startScript(pid, sid))
  ipcMain.handle(IPC.ScriptsStop, (_e, key: string) => controller.stopSession(key))
  ipcMain.handle(IPC.ScriptsRestart, (_e, pid: string, sid: string) => controller.restartScript(pid, sid))

  ipcMain.handle(IPC.TerminalWrite, (_e, key: string, data: string) => controller.writeTerminal(key, data))
  ipcMain.handle(IPC.TerminalResize, (_e, key: string, c: number, r: number) =>
    controller.resizeTerminal(key, c, r)
  )
  ipcMain.handle(IPC.TerminalGetBuffer, (_e, key: string) => controller.getBuffer(key))

  ipcMain.handle(IPC.ShellOpenExternal, (_e, url: string) => shell.openExternal(url))
  ipcMain.handle(IPC.ShellOpenPath, (_e, p: string) => shell.openPath(p))

  ipcMain.handle(IPC.EnvRead, (_e, p: string) => controller.readEnvFile(p))
  ipcMain.handle(IPC.EnvWrite, (_e, p: string, content: string) => controller.writeEnvFile(p, content))

  ipcMain.handle(IPC.UiGetState, () => controller.getUiState())
  ipcMain.handle(IPC.UiSetState, (_e, partial) => {
    controller.setUiState(partial)
    if (partial.theme) nativeTheme.themeSource = partial.theme
  })
  ipcMain.handle(IPC.SessionsList, () => controller.listSessions())
}
