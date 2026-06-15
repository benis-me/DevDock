import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { AppController } from './AppController'
import { FileWatcher } from './services/FileWatcher'
import { registerIpc } from './ipc/registerIpc'

let mainWindow: BrowserWindow | null = null
let controller: AppController

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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
  const watcher = new FileWatcher((id) => controller.handleWatchChange(id))
  controller = new AppController(configPath, watcher)
  nativeTheme.themeSource = controller.getUiState().theme
  controller.startWatchingAll()
  registerIpc(controller, () => mainWindow)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  controller?.shutdown()
})
