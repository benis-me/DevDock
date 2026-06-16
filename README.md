# DevDock

A lightweight desktop app for managing your local projects' dev scripts. Add a project
folder, DevDock scans its runnable scripts (`package.json`, and more), and lets you start /
stop / restart them, watch their live terminals, track status, and edit their `.env` files —
all from one window.

> macOS-first, built with Electron + React. Black / white / gray, keyboard-friendly,
> terminal-forward.

## Features

- **Project sidebar** — add folders (button or drag-and-drop), rename, pin to top, drag to
  reorder, collapse to an icon rail. Each project shows a live "running" count.
- **Script management** — scans `package.json` scripts, groups them into **services**
  (long-running: `dev` / `serve` / `preview` …) and **tasks** (one-shot: `build` / `test` …),
  with monorepo workspace awareness. Start / stop / restart with status, PID, uptime, and the
  detected dev-server URL (clickable, incl. portless `*.localhost`).
- **Real terminals** — each running script gets a full `xterm.js` terminal (powered by
  `node-pty`); interactive input, search, and a unified tab strip shared with the env editor.
- **Env editor** — detects `.env` / `.env.*` files, edits them in an embedded CodeMirror
  editor (syntax highlight, save, reload-on-external-change). Project `.env` / `.env.local`
  are injected into the script's environment when you run it.
- **Open with** — detects installed editors & terminals (Cursor, VS Code, Zed, PyCharm,
  iTerm, Ghostty, Warp, …) and opens the project folder in your app of choice.
- **portless integration** — optional per-script toggle to launch a dev server through
  [portless](https://portless.sh/) for clean `https://<name>.localhost` URLs. Detected at
  startup; gracefully falls back to a normal run when not installed.
- **Auto-detect changes** — watches `package.json` / workspace config / `.env` files and
  refreshes the script list (and prompts to restart a running script whose definition changed).
- **Resizable, collapsible panels**, light / dark / system theme, restored tabs across
  restarts, and confirm-before-quit that cleans up child processes.

## Tech stack

Electron · `electron-vite` · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
`xterm.js` · `node-pty` · CodeMirror 6 · Zustand · Vitest. Package manager: **bun**.

## Getting started

Requires **bun** and **Node.js 24+**.

```bash
bun install
bun run dev      # launch the app in dev mode
```

> First install: if the Electron binary doesn't download automatically, run
> `bun pm trust electron && bun install`.

## Scripts

```bash
bun run dev      # dev (electron-vite)
bun run build    # production build → out/
bun run test     # unit tests (vitest)
bun run start    # preview a production build
```

## Project structure

```
src/
  main/        # main process: services (Scanner, ProcessManager, ProjectStore,
               #   FileWatcher, appLauncher), IPC, window
  preload/     # contextBridge → window.devdock
  renderer/    # React UI (Sidebar, ScriptList, RightPanel, Env editor, …)
  shared/      # types + IPC channel constants shared across processes
```

## Contributing

Issues and PRs welcome. Before submitting:

```bash
bun run test
bunx tsc -p tsconfig.node.json --noEmit
bunx tsc -p tsconfig.web.json --noEmit
bun run build
```

## License

[MIT](./LICENSE)
