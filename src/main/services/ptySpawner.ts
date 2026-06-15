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
