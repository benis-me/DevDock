import { shell } from 'electron'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir, tmpdir } from 'os'
import { execFile, execFileSync } from 'child_process'
import type { AppInfo } from '@shared/types'

interface KnownApp {
  id: string
  name: string
  appName: string // the .app bundle filename
  kind: AppInfo['kind']
}

// 常见编辑器 / 终端（按展示顺序）
const KNOWN: KnownApp[] = [
  { id: 'vscode', name: 'VS Code', appName: 'Visual Studio Code.app', kind: 'editor' },
  { id: 'vscode-insiders', name: 'VS Code Insiders', appName: 'Visual Studio Code - Insiders.app', kind: 'editor' },
  { id: 'cursor', name: 'Cursor', appName: 'Cursor.app', kind: 'editor' },
  { id: 'windsurf', name: 'Windsurf', appName: 'Windsurf.app', kind: 'editor' },
  { id: 'zed', name: 'Zed', appName: 'Zed.app', kind: 'editor' },
  { id: 'sublime', name: 'Sublime Text', appName: 'Sublime Text.app', kind: 'editor' },
  { id: 'webstorm', name: 'WebStorm', appName: 'WebStorm.app', kind: 'editor' },
  { id: 'idea', name: 'IntelliJ IDEA', appName: 'IntelliJ IDEA.app', kind: 'editor' },
  { id: 'idea-ce', name: 'IntelliJ IDEA CE', appName: 'IntelliJ IDEA CE.app', kind: 'editor' },
  { id: 'pycharm', name: 'PyCharm', appName: 'PyCharm.app', kind: 'editor' },
  { id: 'pycharm-ce', name: 'PyCharm CE', appName: 'PyCharm CE.app', kind: 'editor' },
  { id: 'goland', name: 'GoLand', appName: 'GoLand.app', kind: 'editor' },
  { id: 'xcode', name: 'Xcode', appName: 'Xcode.app', kind: 'editor' },
  { id: 'iterm', name: 'iTerm', appName: 'iTerm.app', kind: 'terminal' },
  { id: 'ghostty', name: 'Ghostty', appName: 'Ghostty.app', kind: 'terminal' },
  { id: 'warp', name: 'Warp', appName: 'Warp.app', kind: 'terminal' },
  { id: 'kitty', name: 'kitty', appName: 'kitty.app', kind: 'terminal' },
  { id: 'alacritty', name: 'Alacritty', appName: 'Alacritty.app', kind: 'terminal' },
  { id: 'wezterm', name: 'WezTerm', appName: 'WezTerm.app', kind: 'terminal' },
  { id: 'hyper', name: 'Hyper', appName: 'Hyper.app', kind: 'terminal' },
  { id: 'terminal', name: 'Terminal', appName: 'Terminal.app', kind: 'terminal' }
]

const SEARCH_DIRS = [
  '/Applications',
  join(homedir(), 'Applications'),
  '/System/Applications',
  '/System/Applications/Utilities'
]

const FINDER_PATH = '/System/Library/CoreServices/Finder.app'

function findAppPath(appName: string): string | null {
  for (const dir of SEARCH_DIRS) {
    const p = join(dir, appName)
    if (existsSync(p)) return p
  }
  return null
}

let cache: { apps: AppInfo[]; paths: Map<string, string> } | null = null

const TMP_ICON = join(tmpdir(), 'devdock-app-icon.png')

// 用 macOS 自带 sips 把 app 的 .icns 转成 PNG（各 app 各不相同，可靠）
function iconFor(appPath: string): string {
  try {
    const resDir = join(appPath, 'Contents', 'Resources')
    const icns = readdirSync(resDir).filter((f) => f.toLowerCase().endsWith('.icns'))
    if (icns.length === 0) return ''
    const pick = icns.find((f) => /appicon|^icon/i.test(f)) ?? icns[0]
    execFileSync(
      'sips',
      ['-s', 'format', 'png', '-z', '64', '64', join(resDir, pick), '--out', TMP_ICON],
      { stdio: 'ignore' }
    )
    return `data:image/png;base64,${readFileSync(TMP_ICON).toString('base64')}`
  } catch {
    return ''
  }
}

export async function detectApps(): Promise<AppInfo[]> {
  if (cache) return cache.apps
  const apps: AppInfo[] = []
  const paths = new Map<string, string>()
  for (const k of KNOWN) {
    const appPath = findAppPath(k.appName)
    if (!appPath) continue
    paths.set(k.id, appPath)
    apps.push({ id: k.id, name: k.name, kind: k.kind, icon: iconFor(appPath) })
  }
  // Finder 总是可用
  paths.set('finder', FINDER_PATH)
  apps.push({ id: 'finder', name: 'Finder', kind: 'other', icon: iconFor(FINDER_PATH) })
  cache = { apps, paths }
  return apps
}

export function openWith(appId: string, folder: string): void {
  if (appId === 'finder') {
    shell.openPath(folder)
    return
  }
  const appPath = cache?.paths.get(appId)
  if (!appPath) {
    shell.openPath(folder)
    return
  }
  execFile('open', ['-a', appPath, folder], () => {})
}
