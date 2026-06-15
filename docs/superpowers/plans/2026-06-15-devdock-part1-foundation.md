# DevDock 实现计划 Part 1 — 基础与核心服务

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 electron-vite + React19 + Tailwind4 + shadcn 骨架，并实现全部主进程纯逻辑服务（UrlDetector / Scanner / ProjectStore / scriptDiff / ProcessManager），每个服务带完整单测。

**Architecture:** 主进程服务层负责所有「真相」。本 Part 只做可独立单测的服务与脚手架，不接 IPC、不接 UI。ProcessManager 通过依赖注入接收 pty 生成器，避免 node-pty 原生模块在 vitest（系统 node ABI）下无法加载。

**Tech Stack:** Electron, electron-vite, Vite 8, React 19, TypeScript, Tailwind 4, shadcn/ui, node-pty, Vitest。

完成本 Part 后产出：能启动的空白窗口 + 全绿的核心逻辑单测。

---

### Task 1: 脚手架 — electron-vite + React + TS 空白窗口

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `.gitignore`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`

- [ ] **Step 1: 初始化 package.json 并安装依赖**

```bash
npm init -y
# 注意：不设置 "type": "module"——main/preload 编译为 CJS，依赖 __dirname/require
npm pkg set name=devdock version=0.1.0 main=./out/main/index.js
npm pkg set scripts.dev="electron-vite dev"
npm pkg set scripts.build="electron-vite build"
npm pkg set scripts.start="electron-vite preview"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm i react react-dom
npm i -D electron electron-vite vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node
npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: 写配置文件**

`.gitignore`:
```
node_modules
out
dist
*.log
.DS_Store
```

`electron.vite.config.ts`:
```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const sharedAlias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: sharedAlias }, plugins: [externalizeDepsPlugin()] },
  preload: { resolve: { alias: sharedAlias }, plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: { alias: { '@': resolve('src/renderer/src'), ...sharedAlias } },
    plugins: [react()]
  }
})
```

`vitest.config.ts`（让测试解析 `@`/`@shared` 别名）:
```ts
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': resolve('src/renderer/src'), '@shared': resolve('src/shared') }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts']
  }
})
```

`vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`tsconfig.json`:
```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "electron.vite.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/renderer/src/*"], "@shared/*": ["src/shared/*"] }
  },
  "include": ["src/renderer/src/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 3: 写最小 main / preload / renderer**

`src/main/index.ts`:
```ts
import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'

function createWindow(): void {
  const win = new BrowserWindow({
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

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'system'
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

`src/preload/index.ts`:
```ts
// 占位，Part 2 在此暴露 window.devdock
export {}
```

`src/renderer/index.html`:
```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevDock</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/renderer/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

`src/renderer/src/App.tsx`:
```tsx
export default function App(): JSX.Element {
  return <div style={{ padding: 24, fontFamily: 'system-ui' }}>DevDock</div>
}
```

- [ ] **Step 4: 验证空窗口启动**

Run: `npm run dev`
Expected: 弹出一个标题为 DevDock 的窗口，左上角显示 "DevDock" 文本。手动关闭窗口。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + ts"
```

---

### Task 2: Tailwind 4 + shadcn 主题底座

**Files:**
- Create: `src/renderer/src/styles/globals.css`, `components.json`, `src/renderer/src/lib/utils.ts`
- Modify: `electron.vite.config.ts`, `src/renderer/src/main.tsx`

- [ ] **Step 1: 安装 Tailwind 4 与工具依赖**

```bash
npm i -D tailwindcss @tailwindcss/vite
npm i class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 2: 接入 Tailwind vite 插件**

Modify `electron.vite.config.ts` renderer 部分（加入 tailwindcss 插件）：
```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedAlias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: { resolve: { alias: sharedAlias }, plugins: [externalizeDepsPlugin()] },
  preload: { resolve: { alias: sharedAlias }, plugins: [externalizeDepsPlugin()] },
  renderer: {
    resolve: { alias: { '@': resolve('src/renderer/src'), ...sharedAlias } },
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Step 3: 写 globals.css（含 shadcn v4 主题变量 + 跟随系统暗色）**

`src/renderer/src/styles/globals.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

* { border-color: var(--color-border); }
body { background: var(--color-background); color: var(--color-foreground); margin: 0; }
html, body, #root { height: 100%; }
```

- [ ] **Step 4: 写 lib/utils.ts 与 components.json，导入 css**

`src/renderer/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

`components.json`（供 `npx shadcn add` 使用）:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Modify `src/renderer/src/main.tsx`，在顶部加入：
```tsx
import './styles/globals.css'
```

- [ ] **Step 5: 添加基础 shadcn 组件并验证**

```bash
npx shadcn@latest add button input dialog dropdown-menu tooltip scroll-area separator badge sonner
```
Run: `npm run dev`
Expected: 窗口正常启动无样式报错；`src/renderer/src/components/ui/` 下生成 button.tsx 等文件。手动关闭窗口。

> 若 shadcn CLI 因自定义目录报错，改为手动从 https://ui.shadcn.com 复制对应组件源码到 `src/renderer/src/components/ui/` 并 `npm i @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-separator sonner`。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add tailwind4 + shadcn theme base"
```

---

### Task 3: 共享类型与 IPC 通道常量

**Files:**
- Create: `src/shared/types.ts`, `src/shared/ipc.ts`

- [ ] **Step 1: 写共享类型**

`src/shared/types.ts`:
```ts
export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun'
export type ScriptKind = 'long-running' | 'one-shot'
export type SessionStatus = 'starting' | 'running' | 'exited' | 'errored'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface ScriptDef {
  id: string            // `${relPath}#${name}`
  name: string
  command: string
  kind: ScriptKind
  cwd: string
}

export interface WorkspacePkg {
  name: string
  relPath: string       // 相对项目根，根包为 "."
  scripts: ScriptDef[]
}

export interface Project {
  id: string
  name: string
  path: string
  packageManager: PackageManager
  isMonorepo: boolean
  workspaces: WorkspacePkg[]
  addedAt: number
  missing?: boolean
}

export interface UiState {
  theme: ThemeMode
  selectedProjectId?: string
  lastSelectedScriptId?: string
}

export interface Config {
  version: number
  projects: Project[]
  ui: UiState
}

export interface SessionState {
  scriptId: string
  pid: number
  status: SessionStatus
  startedAt: number
  exitCode?: number
  url?: string
}

export const CONFIG_VERSION = 1

export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  projects: [],
  ui: { theme: 'system' }
}
```

- [ ] **Step 2: 写 IPC 通道常量**

`src/shared/ipc.ts`:
```ts
export const IPC = {
  // invoke 命令
  ProjectsList: 'projects:list',
  ProjectsAdd: 'projects:add',
  ProjectsRemove: 'projects:remove',
  ProjectsRename: 'projects:rename',
  ProjectsRescan: 'projects:rescan',
  ProjectsRelocate: 'projects:relocate',
  ScriptsStart: 'scripts:start',
  ScriptsStop: 'scripts:stop',
  ScriptsRestart: 'scripts:restart',
  TerminalWrite: 'terminal:write',
  TerminalResize: 'terminal:resize',
  TerminalGetBuffer: 'terminal:getBuffer',
  ShellOpenExternal: 'shell:openExternal',
  ShellRevealInFinder: 'shell:revealInFinder',
  DialogPickDirectory: 'dialog:pickDirectory',
  UiGetState: 'ui:getState',
  UiSetState: 'ui:setState',
  SessionsList: 'sessions:list',
  // 事件（main → renderer）
  EvtTerminalData: 'evt:terminal:data',
  EvtSessionStatus: 'evt:session:status',
  EvtSessionUrl: 'evt:session:url',
  EvtProjectUpdated: 'evt:project:updated',
  EvtScriptChanged: 'evt:script:changed'
} as const
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shared types and ipc channel constants"
```

---

### Task 4: UrlDetector（TDD）

**Files:**
- Create: `src/main/services/UrlDetector.ts`
- Test: `src/main/services/UrlDetector.test.ts`

- [ ] **Step 1: 写失败测试**

`src/main/services/UrlDetector.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { stripAnsi, detectUrl } from './UrlDetector'

describe('stripAnsi', () => {
  it('removes ANSI escape codes', () => {
    expect(stripAnsi('[32mhello[0m')).toBe('hello')
  })
})

describe('detectUrl', () => {
  it('detects localhost with port', () => {
    expect(detectUrl('Server running at http://localhost:5173/')).toBe('http://localhost:5173/')
  })

  it('detects 127.0.0.1', () => {
    expect(detectUrl('listening on http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000')
  })

  it('detects portless *.localhost', () => {
    expect(detectUrl('ready at https://my-app.localhost')).toBe('https://my-app.localhost')
  })

  it('prefers the line mentioning Local', () => {
    const out = 'VITE ready\n  ➜  Network: http://192.168.1.5:5173/\n  ➜  Local:   http://localhost:5173/\n'
    expect(detectUrl(out)).toBe('http://localhost:5173/')
  })

  it('handles ANSI-wrapped vite output', () => {
    const out = '  [32m➜[0m  [1mLocal[0m:   [36mhttp://localhost:4321/[0m'
    expect(detectUrl(out)).toBe('http://localhost:4321/')
  })

  it('returns null when no url', () => {
    expect(detectUrl('compiling...')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/main/services/UrlDetector.test.ts`
Expected: FAIL（找不到模块 `./UrlDetector`）。

- [ ] **Step 3: 实现 UrlDetector**

`src/main/services/UrlDetector.ts`:
```ts
const ANSI_REGEX =
  // eslint-disable-next-line no-control-regex
  /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

const URL_REGEX =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w.-]+\.localhost)(?::\d+)?(?:\/[^\s]*)?/gi

export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}

export function detectUrl(input: string): string | null {
  const text = stripAnsi(input)
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (/local/i.test(line)) {
      const m = line.match(URL_REGEX)
      if (m && m.length) return m[0]
    }
  }
  const all = text.match(URL_REGEX)
  return all && all.length ? all[0] : null
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/main/services/UrlDetector.test.ts`
Expected: PASS（6 个用例全过）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add UrlDetector with ansi strip and localhost/portless detection"
```

---

### Task 5: Scanner — 包管理器检测（TDD）

**Files:**
- Create: `src/main/services/Scanner.ts`
- Test: `src/main/services/Scanner.pm.test.ts`

- [ ] **Step 1: 写失败测试（用临时目录 fixture）**

`src/main/services/Scanner.pm.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { detectPackageManager } from './Scanner'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devdock-pm-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function touch(name: string): void {
  writeFileSync(join(dir, name), '')
}

describe('detectPackageManager', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    touch('pnpm-lock.yaml')
    expect(detectPackageManager(dir)).toBe('pnpm')
  })
  it('detects yarn from yarn.lock', () => {
    touch('yarn.lock')
    expect(detectPackageManager(dir)).toBe('yarn')
  })
  it('detects bun from bun.lockb', () => {
    touch('bun.lockb')
    expect(detectPackageManager(dir)).toBe('bun')
  })
  it('detects npm from package-lock.json', () => {
    touch('package-lock.json')
    expect(detectPackageManager(dir)).toBe('npm')
  })
  it('defaults to npm when no lockfile', () => {
    expect(detectPackageManager(dir)).toBe('npm')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/main/services/Scanner.pm.test.ts`
Expected: FAIL（`detectPackageManager` 未定义）。

- [ ] **Step 3: 实现 detectPackageManager**

`src/main/services/Scanner.ts`:
```ts
import { existsSync } from 'fs'
import { join } from 'path'
import type { PackageManager } from '@shared/types'

export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(dir, 'bun.lockb'))) return 'bun'
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm'
  return 'npm'
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/main/services/Scanner.pm.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add package manager detection to Scanner"
```

---

### Task 6: Scanner — 脚本分类（TDD）

**Files:**
- Modify: `src/main/services/Scanner.ts`
- Test: `src/main/services/Scanner.classify.test.ts`

- [ ] **Step 1: 写失败测试**

`src/main/services/Scanner.classify.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifyScript } from './Scanner'

describe('classifyScript', () => {
  it('classifies dev as long-running by name', () => {
    expect(classifyScript('dev', 'vite')).toBe('long-running')
  })
  it('classifies start/serve/watch/preview by name', () => {
    expect(classifyScript('start', 'node server.js')).toBe('long-running')
    expect(classifyScript('serve', 'http-server')).toBe('long-running')
    expect(classifyScript('watch', 'tsc -w')).toBe('long-running')
    expect(classifyScript('preview', 'vite preview')).toBe('long-running')
  })
  it('classifies by known dev-server command', () => {
    expect(classifyScript('app', 'next dev')).toBe('long-running')
    expect(classifyScript('ui', 'webpack serve')).toBe('long-running')
  })
  it('classifies build/lint/test as one-shot', () => {
    expect(classifyScript('build', 'tsc && vite build')).toBe('one-shot')
    expect(classifyScript('lint', 'eslint .')).toBe('one-shot')
    expect(classifyScript('test', 'vitest run')).toBe('one-shot')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/main/services/Scanner.classify.test.ts`
Expected: FAIL（`classifyScript` 未定义）。

- [ ] **Step 3: 实现 classifyScript（追加到 Scanner.ts）**

在 `src/main/services/Scanner.ts` 顶部已有 import 之后追加：
```ts
import type { ScriptKind } from '@shared/types'

const LONG_RUNNING_NAME = /^(dev|start|serve|watch|preview)(:|$)/i
const LONG_RUNNING_CMD =
  /(vite(?!\s+build)|next\s+dev|nuxt\s+dev|webpack(\s+serve|-dev-server)|react-scripts\s+start|vue-cli-service\s+serve|astro\s+dev|remix\s+dev|nodemon|tsc\s+-w|--watch)/i

export function classifyScript(name: string, command: string): ScriptKind {
  if (LONG_RUNNING_NAME.test(name)) return 'long-running'
  if (LONG_RUNNING_CMD.test(command)) return 'long-running'
  return 'one-shot'
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/main/services/Scanner.classify.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add script classification to Scanner"
```

---

### Task 7: Scanner — scanProject 含 workspace 解析（TDD）

**Files:**
- Modify: `src/main/services/Scanner.ts`
- Test: `src/main/services/Scanner.scan.test.ts`

- [ ] **Step 1: 安装 workspace 解析依赖**

```bash
npm i fast-glob js-yaml
npm i -D @types/js-yaml
```

- [ ] **Step 2: 写失败测试**

`src/main/services/Scanner.scan.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanProject } from './Scanner'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'devdock-scan-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function writePkg(rel: string, json: object): void {
  const full = join(dir, rel)
  mkdirSync(full, { recursive: true })
  writeFileSync(join(full, 'package.json'), JSON.stringify(json))
}

describe('scanProject', () => {
  it('scans a single-package project', () => {
    writePkg('.', { name: 'app', scripts: { dev: 'vite', build: 'vite build' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(false)
    expect(r.workspaces).toHaveLength(1)
    expect(r.workspaces[0].relPath).toBe('.')
    const ids = r.workspaces[0].scripts.map((s) => s.id).sort()
    expect(ids).toEqual(['.#build', '.#dev'])
    const dev = r.workspaces[0].scripts.find((s) => s.name === 'dev')!
    expect(dev.kind).toBe('long-running')
    expect(dev.cwd).toBe(dir)
  })

  it('detects npm/yarn workspaces glob', () => {
    writePkg('.', { name: 'root', private: true, workspaces: ['packages/*'] })
    writePkg('packages/web', { name: 'web', scripts: { dev: 'vite' } })
    writePkg('packages/api', { name: 'api', scripts: { start: 'node index.js' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    const rels = r.workspaces.map((w) => w.relPath).sort()
    expect(rels).toEqual(['packages/api', 'packages/web'])
  })

  it('detects pnpm-workspace.yaml', () => {
    writePkg('.', { name: 'root', private: true })
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    writePkg('apps/site', { name: 'site', scripts: { dev: 'astro dev' } })
    const r = scanProject(dir)
    expect(r.isMonorepo).toBe(true)
    expect(r.workspaces.map((w) => w.relPath)).toContain('apps/site')
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/main/services/Scanner.scan.test.ts`
Expected: FAIL（`scanProject` 未定义）。

- [ ] **Step 4: 实现 scanProject（追加到 Scanner.ts）**

在 `src/main/services/Scanner.ts` 顶部 import 区追加，并实现函数：
```ts
import { readFileSync } from 'fs'
import { dirname, relative, sep } from 'path'
import fg from 'fast-glob'
import yaml from 'js-yaml'
import type { ScriptDef, WorkspacePkg } from '@shared/types'

export interface ScannedProject {
  isMonorepo: boolean
  packageManager: PackageManager
  workspaces: WorkspacePkg[]
}

function readJson(file: string): any {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function toRel(root: string, full: string): string {
  const r = relative(root, full).split(sep).join('/')
  return r === '' ? '.' : r
}

function buildWorkspace(root: string, pkgJsonPath: string): WorkspacePkg | null {
  const pkg = readJson(pkgJsonPath)
  if (!pkg) return null
  const cwd = dirname(pkgJsonPath)
  const relPath = toRel(root, cwd)
  const scriptsObj: Record<string, string> = pkg.scripts ?? {}
  const scripts: ScriptDef[] = Object.entries(scriptsObj).map(([name, command]) => ({
    id: `${relPath}#${name}`,
    name,
    command,
    kind: classifyScript(name, command),
    cwd
  }))
  return { name: pkg.name ?? relPath, relPath, scripts }
}

function readWorkspacePatterns(root: string): string[] {
  const patterns: string[] = []
  const rootPkg = readJson(join(root, 'package.json'))
  if (rootPkg?.workspaces) {
    const ws = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages
    if (Array.isArray(ws)) patterns.push(...ws)
  }
  const pnpmFile = join(root, 'pnpm-workspace.yaml')
  if (existsSync(pnpmFile)) {
    try {
      const parsed = yaml.load(readFileSync(pnpmFile, 'utf8')) as { packages?: string[] }
      if (Array.isArray(parsed?.packages)) patterns.push(...parsed.packages)
    } catch {
      /* ignore malformed yaml */
    }
  }
  return patterns
}

export function scanProject(root: string): ScannedProject {
  const packageManager = detectPackageManager(root)
  const patterns = readWorkspacePatterns(root)
  const isMonorepo = patterns.length > 0
  const workspaces: WorkspacePkg[] = []

  const rootWs = buildWorkspace(root, join(root, 'package.json'))

  if (isMonorepo) {
    const pkgGlobs = patterns.map((p) => `${p.replace(/\/$/, '')}/package.json`)
    const found = fg.sync(pkgGlobs, {
      cwd: root,
      absolute: true,
      ignore: ['**/node_modules/**'],
      onlyFiles: true
    })
    for (const f of found) {
      const ws = buildWorkspace(root, f)
      if (ws) workspaces.push(ws)
    }
    workspaces.sort((a, b) => a.relPath.localeCompare(b.relPath))
  } else if (rootWs) {
    workspaces.push(rootWs)
  }

  return { isMonorepo, packageManager, workspaces }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/main/services/Scanner.scan.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add scanProject with workspace resolution"
```

---

### Task 8: scriptDiff（TDD）

**Files:**
- Create: `src/main/services/scriptDiff.ts`
- Test: `src/main/services/scriptDiff.test.ts`

- [ ] **Step 1: 写失败测试**

`src/main/services/scriptDiff.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { diffScripts } from './scriptDiff'
import type { WorkspacePkg } from '@shared/types'

function ws(scripts: Array<[string, string]>): WorkspacePkg[] {
  return [
    {
      name: 'app',
      relPath: '.',
      scripts: scripts.map(([name, command]) => ({
        id: `.#${name}`,
        name,
        command,
        kind: 'one-shot' as const,
        cwd: '/x'
      }))
    }
  ]
}

describe('diffScripts', () => {
  it('detects added, removed and changed scripts by id and command', () => {
    const before = ws([['dev', 'vite'], ['build', 'vite build'], ['lint', 'eslint .']])
    const after = ws([['dev', 'vite --host'], ['build', 'vite build'], ['test', 'vitest']])
    const d = diffScripts(before, after)
    expect(d.added).toEqual(['.#test'])
    expect(d.removed).toEqual(['.#lint'])
    expect(d.changed).toEqual(['.#dev'])
  })

  it('returns empty diff when identical', () => {
    const a = ws([['dev', 'vite']])
    const d = diffScripts(a, ws([['dev', 'vite']]))
    expect(d).toEqual({ added: [], removed: [], changed: [] })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/main/services/scriptDiff.test.ts`
Expected: FAIL（模块未找到）。

- [ ] **Step 3: 实现 scriptDiff**

`src/main/services/scriptDiff.ts`:
```ts
import type { WorkspacePkg, ScriptDef } from '@shared/types'

export interface ScriptDiff {
  added: string[]
  removed: string[]
  changed: string[]
}

function flatten(workspaces: WorkspacePkg[]): Map<string, ScriptDef> {
  const map = new Map<string, ScriptDef>()
  for (const ws of workspaces) for (const s of ws.scripts) map.set(s.id, s)
  return map
}

export function diffScripts(before: WorkspacePkg[], after: WorkspacePkg[]): ScriptDiff {
  const a = flatten(before)
  const b = flatten(after)
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const id of b.keys()) if (!a.has(id)) added.push(id)
  for (const id of a.keys()) if (!b.has(id)) removed.push(id)
  for (const [id, def] of a) {
    const next = b.get(id)
    if (next && next.command !== def.command) changed.push(id)
  }
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort()
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/main/services/scriptDiff.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scriptDiff for detecting script changes"
```

---

### Task 9: ProjectStore（TDD）

**Files:**
- Create: `src/main/services/ProjectStore.ts`
- Test: `src/main/services/ProjectStore.test.ts`

- [ ] **Step 1: 写失败测试**

`src/main/services/ProjectStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ProjectStore } from './ProjectStore'
import { DEFAULT_CONFIG } from '@shared/types'

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'devdock-store-'))
  file = join(dir, 'config.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('ProjectStore', () => {
  it('returns default config when file is missing', () => {
    const store = new ProjectStore(file)
    expect(store.load()).toEqual(DEFAULT_CONFIG)
  })

  it('persists and reloads config', () => {
    const store = new ProjectStore(file)
    const cfg = store.load()
    cfg.ui.theme = 'dark'
    store.save(cfg)
    const store2 = new ProjectStore(file)
    expect(store2.load().ui.theme).toBe('dark')
  })

  it('creates parent directory on save', () => {
    const nested = join(dir, 'a', 'b', 'config.json')
    const store = new ProjectStore(nested)
    store.save(store.load())
    expect(existsSync(nested)).toBe(true)
  })

  it('backs up and resets on corrupt json', () => {
    writeFileSync(file, '{ not json')
    const store = new ProjectStore(file)
    expect(store.load()).toEqual(DEFAULT_CONFIG)
    expect(existsSync(file + '.bak')).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/main/services/ProjectStore.test.ts`
Expected: FAIL（模块未找到）。

- [ ] **Step 3: 实现 ProjectStore**

`src/main/services/ProjectStore.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { dirname } from 'path'
import { DEFAULT_CONFIG, CONFIG_VERSION, type Config } from '@shared/types'

export class ProjectStore {
  constructor(private readonly filePath: string) {}

  load(): Config {
    if (!existsSync(this.filePath)) return structuredClone(DEFAULT_CONFIG)
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Config
      return this.migrate(parsed)
    } catch {
      renameSync(this.filePath, this.filePath + '.bak')
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  save(config: Config): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf8')
  }

  private migrate(config: Config): Config {
    // 版本迁移占位：当前仅有 v1
    if (!config.version || config.version < CONFIG_VERSION) {
      return { ...structuredClone(DEFAULT_CONFIG), ...config, version: CONFIG_VERSION }
    }
    return config
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/main/services/ProjectStore.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ProjectStore with persistence, migration and corruption recovery"
```

---

### Task 10: ProcessManager（依赖注入 pty，TDD）

**Files:**
- Create: `src/main/services/ProcessManager.ts`, `src/main/services/ptySpawner.ts`
- Test: `src/main/services/ProcessManager.test.ts`

- [ ] **Step 1: 安装 node-pty 并对 Electron 重建**

```bash
npm i node-pty
npm i -D @electron/rebuild
npx electron-rebuild -f -w node-pty
```
> 说明：node-pty 是原生模块，需对 Electron ABI 重建。ProcessManager 通过注入 `PtySpawner` 解耦，使单测可用 FakePty，不依赖原生模块。

- [ ] **Step 2: 写失败测试（FakePty 驱动状态机）**

`src/main/services/ProcessManager.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { ProcessManager } from './ProcessManager'
import type { IPty, PtySpawner } from './ptySpawner'

function makeFakePty(): { pty: IPty; emitData: (d: string) => void; emitExit: (code: number) => void } {
  let dataCb: (d: string) => void = () => {}
  let exitCb: (e: { exitCode: number }) => void = () => {}
  const pty: IPty = {
    pid: 4242,
    onData: (cb) => (dataCb = cb),
    onExit: (cb) => (exitCb = cb),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(() => exitCb({ exitCode: 0 }))
  }
  return { pty, emitData: (d) => dataCb(d), emitExit: (code) => exitCb({ exitCode: code }) }
}

describe('ProcessManager', () => {
  it('transitions starting -> running and emits status', () => {
    const fake = makeFakePty()
    const spawner: PtySpawner = () => fake.pty
    const pm = new ProcessManager(spawner)
    const statuses: string[] = []
    pm.on('status', (s) => statuses.push(s.status))

    pm.start({ scriptId: '.#dev', command: 'pnpm run dev', cwd: '/x' })
    expect(pm.getState('.#dev')?.status).toBe('starting')
    fake.emitData('VITE ready\n')
    expect(pm.getState('.#dev')?.status).toBe('running')
    expect(statuses).toContain('starting')
    expect(statuses).toContain('running')
  })

  it('detects url from output and emits url event', () => {
    const fake = makeFakePty()
    const pm = new ProcessManager(() => fake.pty)
    const urls: string[] = []
    pm.on('url', (_id, url) => urls.push(url))
    pm.start({ scriptId: '.#dev', command: 'x', cwd: '/x' })
    fake.emitData('  ➜  Local:   http://localhost:5173/\n')
    expect(pm.getState('.#dev')?.url).toBe('http://localhost:5173/')
    expect(urls).toEqual(['http://localhost:5173/'])
  })

  it('keeps a scrollback buffer retrievable via getBuffer', () => {
    const fake = makeFakePty()
    const pm = new ProcessManager(() => fake.pty)
    pm.start({ scriptId: '.#dev', command: 'x', cwd: '/x' })
    fake.emitData('hello ')
    fake.emitData('world')
    expect(pm.getBuffer('.#dev')).toBe('hello world')
  })

  it('marks exited with exit code on process exit', () => {
    const fake = makeFakePty()
    const pm = new ProcessManager(() => fake.pty)
    pm.start({ scriptId: '.#build', command: 'x', cwd: '/x' })
    fake.emitExit(1)
    const st = pm.getState('.#build')
    expect(st?.status).toBe('exited')
    expect(st?.exitCode).toBe(1)
  })

  it('stop kills the pty', () => {
    const fake = makeFakePty()
    const pm = new ProcessManager(() => fake.pty)
    pm.start({ scriptId: '.#dev', command: 'x', cwd: '/x' })
    pm.stop('.#dev')
    expect(fake.pty.kill).toHaveBeenCalled()
    expect(pm.getState('.#dev')?.status).toBe('exited')
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/main/services/ProcessManager.test.ts`
Expected: FAIL（模块未找到）。

- [ ] **Step 4: 实现 ptySpawner 接口与真实实现**

`src/main/services/ptySpawner.ts`:
```ts
export interface IPty {
  pid: number
  onData(cb: (data: string) => void): void
  onExit(cb: (e: { exitCode: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
}

export interface SpawnOptions {
  cwd: string
  env: NodeJS.ProcessEnv
  cols: number
  rows: number
}

export type PtySpawner = (command: string, opts: SpawnOptions) => IPty

export const realPtySpawner: PtySpawner = (command, opts) => {
  // 延迟 require，避免单测加载原生模块
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pty = require('node-pty')
  const shell =
    process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/bash'
  const args = process.platform === 'win32' ? ['-Command', command] : ['-lc', command]
  const proc = pty.spawn(shell, args, {
    name: 'xterm-color',
    cwd: opts.cwd,
    env: opts.env,
    cols: opts.cols,
    rows: opts.rows
  })
  return {
    pid: proc.pid,
    onData: (cb) => proc.onData(cb),
    onExit: (cb) => proc.onExit((e: { exitCode: number }) => cb({ exitCode: e.exitCode })),
    write: (d) => proc.write(d),
    resize: (c, r) => proc.resize(c, r),
    kill: (s) => proc.kill(s)
  }
}
```

- [ ] **Step 5: 实现 ProcessManager**

`src/main/services/ProcessManager.ts`:
```ts
import { EventEmitter } from 'events'
import type { SessionState } from '@shared/types'
import { detectUrl } from './UrlDetector'
import { realPtySpawner, type IPty, type PtySpawner } from './ptySpawner'

interface Session {
  state: SessionState
  pty: IPty
  buffer: string
  command: string
  cwd: string
}

const BUFFER_LIMIT = 200_000

export interface StartOptions {
  scriptId: string
  command: string
  cwd: string
  env?: NodeJS.ProcessEnv
}

export class ProcessManager extends EventEmitter {
  private sessions = new Map<string, Session>()

  constructor(private readonly spawner: PtySpawner = realPtySpawner) {
    super()
  }

  start(opts: StartOptions): void {
    this.stop(opts.scriptId) // 重启幂等
    const pty = this.spawner(opts.command, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env, FORCE_COLOR: '1' },
      cols: 80,
      rows: 24
    })
    const state: SessionState = {
      scriptId: opts.scriptId,
      pid: pty.pid,
      status: 'starting',
      startedAt: Date.now()
    }
    const session: Session = { state, pty, buffer: '', command: opts.command, cwd: opts.cwd }
    this.sessions.set(opts.scriptId, session)
    this.emit('status', { ...state })

    pty.onData((data) => {
      session.buffer = (session.buffer + data).slice(-BUFFER_LIMIT)
      this.emit('data', opts.scriptId, data)
      if (session.state.status === 'starting') {
        session.state.status = 'running'
        this.emit('status', { ...session.state })
      }
      if (!session.state.url) {
        const url = detectUrl(data)
        if (url) {
          session.state.url = url
          this.emit('url', opts.scriptId, url)
        }
      }
    })

    pty.onExit(({ exitCode }) => {
      session.state.status = exitCode === 0 ? 'exited' : exitCode > 0 ? 'exited' : 'errored'
      session.state.exitCode = exitCode
      session.state.url = undefined
      this.emit('status', { ...session.state })
    })
  }

  stop(scriptId: string): void {
    const s = this.sessions.get(scriptId)
    if (!s) return
    if (s.state.status === 'starting' || s.state.status === 'running') {
      try {
        s.pty.kill()
      } catch {
        /* already dead */
      }
      if (s.state.status !== 'exited') {
        s.state.status = 'exited'
        this.emit('status', { ...s.state })
      }
    }
  }

  restart(opts: StartOptions): void {
    this.start(opts)
  }

  write(scriptId: string, data: string): void {
    this.sessions.get(scriptId)?.pty.write(data)
  }

  resize(scriptId: string, cols: number, rows: number): void {
    this.sessions.get(scriptId)?.pty.resize(cols, rows)
  }

  getBuffer(scriptId: string): string {
    return this.sessions.get(scriptId)?.buffer ?? ''
  }

  getState(scriptId: string): SessionState | undefined {
    const s = this.sessions.get(scriptId)
    return s ? { ...s.state } : undefined
  }

  list(): SessionState[] {
    return [...this.sessions.values()].map((s) => ({ ...s.state }))
  }

  killAll(): void {
    for (const id of this.sessions.keys()) this.stop(id)
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/main/services/ProcessManager.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 7: 运行全部单测并 Commit**

Run: `npm test`
Expected: 所有测试文件全绿。
```bash
git add -A
git commit -m "feat: add ProcessManager with injected pty spawner and url detection"
```

---

## Part 1 完成标准

- `npm run dev` 弹出空白 DevDock 窗口。
- `npm test` 全绿，覆盖 UrlDetector / Scanner（pm+classify+scan）/ scriptDiff / ProjectStore / ProcessManager。
- 主进程纯逻辑服务全部就绪，等待 Part 2 接入 IPC 与 UI。
