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
  // 交互式 login shell（-i）才会读取 .zshrc/.bashrc，nvm/fnm/Homebrew 等
  // Node 版本管理器多在那里初始化。GUI 启动的 .app 拿到的是系统精简 PATH，
  // 不走交互 shell 就会解析到系统自带的旧 node，导致预编译原生模块（better-sqlite3
  // 等）报 NODE_MODULE_VERSION 不匹配。-ilc 让子 shell 与用户终端环境一致。
  const args = process.platform === 'win32' ? ['-Command', command] : ['-ilc', command]
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
