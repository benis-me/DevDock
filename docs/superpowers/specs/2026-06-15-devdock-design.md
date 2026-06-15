# DevDock 设计文档

**日期**: 2026-06-15
**状态**: 已确认设计，待写实现计划

## 1. 目标

DevDock 是一款轻量桌面应用，用于管理本地各个项目的快速启动：

- 用户添加项目文件夹，应用自动扫描启动脚本（前端项目的 `package.json`）。
- 列出各启动项，可快速启动 / 停止 / 重启。
- 管理启动后状态：运行状态、PID、启动时间、网址等。
- 点击脚本项可唤出并查看其对应终端的实时输出。
- 启动相关文件被修改后，应用自动探测并更新脚本列表。

**v1 范围**：仅支持前端项目（`package.json` scripts），支持 monorepo。

## 2. 技术栈

- 构建：Vite 8 + `electron-vite`（统一编译 main/preload/renderer）
- 框架：React 19
- UI：Shadcn + Tailwind 4（CSS 变量主题）
- 桌面：Electron
- 终端前端：`@xterm/xterm` + `addon-fit` / `addon-web-links` / `addon-search`
- 终端后端：`node-pty`（真 PTY，支持颜色与交互）
- 进程内状态：Zustand（渲染层）
- 文件监听：chokidar
- 测试：Vitest + React Testing Library；E2E 用 Playwright for Electron（v1 可选）

## 3. 架构

采用**主进程服务层 + 轻渲染层**模式：进程状态的唯一可信源在主进程，渲染层只做展示并通过 IPC 镜像状态。

```
主进程 (main)                     预加载 (preload)        渲染层 (renderer)
├ ProjectStore   持久化项目配置    contextBridge          React 19 + Shadcn + Tailwind4
├ Scanner        扫描 package.json   → window.devdock     ├ Zustand store(镜像主进程)
├ ProcessManager node-pty 会话管理    命令: invoke        ├ Sidebar    项目列表
├ UrlDetector    解析终端输出网址     事件: on            ├ ScriptList 脚本卡片
└ FileWatcher    chokidar 监听变化                        └ Terminal   xterm.js 终端
```

### 各服务职责（单一职责、可独立测试）

- **ProjectStore**：读写持久化配置（项目列表 + UI 状态），含版本号与迁移。
- **Scanner**：给定目录，检测包管理器、检测 workspaces、解析各包 scripts、分类。纯函数为主，便于单测。
- **ProcessManager**：用 node-pty 启动/停止/重启脚本会话，维护运行时状态机，转发终端 I/O。
- **UrlDetector**：从终端输出（去 ANSI）中提取 dev server 网址。纯函数。
- **FileWatcher**：监听 package.json 与 workspace 配置变化，触发重扫。

## 4. 数据模型

```ts
// 持久化：userData/devdock/config.json
interface Config {
  version: number;
  projects: Project[];
  ui: {
    theme: 'system' | 'light' | 'dark';
    selectedProjectId?: string;
    lastSelectedScriptId?: string;
  };
}

interface Project {
  id: string;                 // uuid
  name: string;               // 默认取文件夹名/package.json name，可编辑
  path: string;               // 绝对路径
  packageManager: 'pnpm' | 'yarn' | 'npm' | 'bun'; // 按 lockfile 检测
  isMonorepo: boolean;
  workspaces: WorkspacePkg[];
  addedAt: number;
}

interface WorkspacePkg {
  name: string;
  relPath: string;            // 相对项目根，根包为 "."
  scripts: ScriptDef[];
}

interface ScriptDef {
  id: string;                 // 稳定 ID: `${relPath}#${name}`
  name: string;               // 如 "dev"
  command: string;            // package.json 中的原始命令
  kind: 'long-running' | 'one-shot';
  cwd: string;                // 运行目录（绝对路径）
}

// 运行时：仅主进程内存，不持久化
interface RunSession {
  scriptId: string;
  pid: number;
  status: 'starting' | 'running' | 'exited' | 'errored';
  startedAt: number;
  exitCode?: number;
  url?: string;               // 探测到的 dev server 网址
  // ptyHandle 由 ProcessManager 内部持有
}
```

主进程为每个会话保留输出环形缓冲，供终端重新挂载（re-attach）时回填。

## 5. 核心流程

### 5.1 添加项目
1. 系统对话框选目录。
2. 检测包管理器：按 lockfile（`pnpm-lock.yaml` → pnpm，`yarn.lock` → yarn，`bun.lockb` → bun，`package-lock.json` → npm；缺省 npm）。
3. 检测 monorepo：根 `package.json` 的 `workspaces` 字段 / `pnpm-workspace.yaml`。
4. 扫描各包 `package.json` 的 scripts，分类。
5. 入库并推送给渲染层。

### 5.2 脚本分类
- `long-running`：脚本名匹配 `^(dev|start|serve|watch|preview)` 或命令包含已知 dev server（vite、next dev、nuxt dev、webpack serve、react-scripts start、vue-cli-service serve、astro dev、remix dev 等）。
- 其余为 `one-shot`（build / lint / test 等）。
- 运行时若进程长时间不退出，可动态修正为 long-running。
- 两类脚本都能启动；UI 上分组展示，长期运行型置顶。

### 5.3 启动 / 停止 / 重启
- ProcessManager 用对应包管理器在脚本 `cwd` 启动 pty（如 `pnpm run dev`）。
- 状态机：`starting → running → exited / errored`。
- 停止：发 `SIGTERM`，超时未退出再 `SIGKILL`。
- 重启：停止后重新启动。

### 5.4 网址探测
- 监听 pty 输出，去除 ANSI 转义后用正则匹配：
  - `https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w.-]+\.localhost)(:\d+)?(/\S*)?`
  - 兼容 portless 风格的 `http(s)://xxxx.localhost`。
- 若输出含「Local:」标记行（如 Vite `➜  Local:   http://localhost:5173/`），优先取该行。
- 探测到后填到 item 上，可点击用系统浏览器打开。
- 脚本停止/退出时清空 url。

### 5.5 文件变更自动探测
- FileWatcher（chokidar）监听各 `package.json`、`pnpm-workspace.yaml` 等 workspace 配置。
- 变更（防抖）后重扫该项目并 diff scripts（新增/删除/改名/改命令）。
- 更新 UI 脚本列表。
- 若某**正在运行**的脚本定义发生变化，额外提示用户是否重启该脚本（重扫 + 提示重启）。

### 5.6 退出
- 关闭前若有运行中脚本，弹窗确认。
- 确认后逐个终止子进程，再退出主进程（不保留后台运行）。

## 6. IPC 接口（`window.devdock`）

**命令（invoke）**
- `projects.list()` / `projects.add()` / `projects.remove(id)` / `projects.rename(id, name)` / `projects.rescan(id)` / `projects.relocate(id, newPath)`
- `scripts.start(scriptId)` / `scripts.stop(scriptId)` / `scripts.restart(scriptId)`
- `terminal.write(scriptId, data)` / `terminal.resize(scriptId, cols, rows)` / `terminal.getBuffer(scriptId)`
- `shell.openExternal(url)` / `shell.revealInFinder(path)` / `dialog.pickDirectory()`
- `ui.getState()` / `ui.setState(partial)`

**事件（on）**
- `terminal.data` `(scriptId, chunk)`
- `session.status` `(scriptId, status, pid, exitCode, startedAt)`
- `session.url` `(scriptId, url)`
- `project.updated` `(project)` — 重扫/监听后
- `script.changed` `(scriptId)` — 运行中脚本定义变化 → 提示重启

预加载层用 contextBridge 暴露，启用 contextIsolation、禁用 nodeIntegration。

## 7. UI 设计

参考 Codex 桌面客户端风格：极简、低饱和、冷调。主题用 Tailwind 4 CSS 变量 + shadcn tokens，跟随系统（`nativeTheme`）并支持手动切换。

### 布局（右侧内容区为左右结构）

```
┌──────────┬───────────────────────────────────────┐
│ DevDock  │ 项目名 路径        [重扫][打开][主题]   │
│ ＋添加   │───────────────────┬───────────────────│
│ ▸ proj-a │ ▾ 服务            │ [dev ×][preview]  │
│ ▸ proj-b●│  ● dev  :5173↗    │ xterm 实时输出…   │
│ ▸ proj-c │  ○ preview  [▶]   │                   │
│          │ ▾ 任务            │  ←可拖拽分隔→      │
│          │  ○ build   [▶]    │                   │
└──────────┴───────────────────┴───────────────────┘
```

- **左栏 Sidebar**（约 260px，可调宽）：应用标题、「＋ 添加项目」、项目列表。每行显示名称、路径(弱化)、运行数徽标；hover/右键菜单：重命名、移除、在 Finder 显示、重扫。选中高亮。
- **右上 Header**：当前项目名 + 路径 + 操作（重扫、打开目录、主题切换）。
- **右侧内容区（左右两栏）**：
  - **左半 ScriptList**：脚本卡片。monorepo 按子包分组（可折叠），组内分「服务（long-running）/任务（one-shot）」。每行：状态点、脚本名、命令(等宽截断)、PID、运行时长、可点击 URL、启停切换、重启。
  - **右半 Terminal**：终端坞，多会话用 tab，可拖拽分隔、可折叠。点选脚本聚焦/打开其 tab，展示 xterm 实时输出，支持输入、自适应尺寸、链接点击、搜索。

## 8. 错误处理与边界

- 包管理器缺失 / cwd 不存在 → 会话 `errored`，终端提示 + toast。
- 项目目录被移动/删除 → 标记「缺失」，禁用操作，提供移除/重新定位（relocate）。
- 端口被占用 → 透传输出，按进程退出处理。
- 配置文件损坏 → 备份后重置并提示。
- node-pty 原生模块需对 Electron 重建（`electron-rebuild` / prebuilt 包），列为已知风险。

## 9. 测试策略（TDD）

- **单测（Vitest）**：
  - Scanner：解析 package.json、脚本分类、包管理器检测、workspace 检测（用 fs fixtures）。
  - UrlDetector：去 ANSI + 正则，覆盖 localhost / IP / `*.localhost` portless。
  - ProjectStore：读写、版本迁移、损坏恢复。
  - 脚本 diff 逻辑。
- **ProcessManager**：用 `node -e` 跨平台假命令验证状态机与退出处理。
- **渲染层（RTL）**：ScriptItem 各状态、Sidebar、Zustand store。
- **E2E（Playwright for Electron）**：v1 可选，先标注。

## 10. 目录结构

```
devdock/
  electron.vite.config.ts
  package.json
  tsconfig*.json
  src/
    main/
      index.ts                # 应用生命周期、窗口、nativeTheme
      ipc/                    # IPC handler 注册
      services/
        ProjectStore.ts
        Scanner.ts
        ProcessManager.ts
        UrlDetector.ts
        FileWatcher.ts
    preload/
      index.ts                # contextBridge → window.devdock
    renderer/
      index.html
      src/
        main.tsx
        App.tsx
        store/                # zustand
        components/
          Sidebar/
          ScriptList/
          Terminal/
          ui/                 # shadcn 组件
        styles/globals.css    # tailwind 4
  tests/  或就近 *.test.ts
```

## 11. 已知风险（搭建时确认版本兼容）

- Vite 8 与 electron-vite 的适配。
- shadcn 对 Tailwind 4 的支持（CSS-first 配置）。
- node-pty 对 Electron 的原生重建。
