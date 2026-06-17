import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { AppController } from './AppController'
import { FileWatcher } from './services/FileWatcher'
import { TrayController } from './services/TrayController'
import { NotificationController } from './services/NotificationController'
import { registerIpc } from './ipc/registerIpc'

let mainWindow: BrowserWindow | null = null
let controller: AppController
let tray: TrayController | null = null

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 16 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const configPath = join(app.getPath('userData'), 'devdock', 'config.json')
  const watcher = new FileWatcher((id, p) => controller.handleWatchChange(id, p))
  controller = new AppController(configPath, watcher)
  controller.refreshPortlessAvailability()
  nativeTheme.themeSource = controller.getUiState().theme
  controller.startWatchingAll()
  registerIpc(controller, () => mainWindow)
  createWindow()
  tray = new TrayController(controller, showMainWindow)
  tray.init()
  new NotificationController(
    controller,
    () => mainWindow?.isFocused() ?? false,
    showMainWindow
  ).init()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  const running = controller
    ?.listSessions()
    .filter((s) => s.status === 'running' || s.status === 'starting')
  if (running && running.length > 0 && controller.getSettings().confirmOnQuit) {
    e.preventDefault()
    const { dialog } = require('electron')
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      buttons: ['退出并终止', '取消'],
      defaultId: 0,
      cancelId: 1,
      message: `有 ${running.length} 个脚本正在运行，确定退出并终止它们吗？`
    })
    if (choice === 0) {
      quitting = true
      controller.shutdown()
      app.quit()
    }
  } else {
    controller?.shutdown()
  }
})

app.on('will-quit', () => tray?.destroy())
