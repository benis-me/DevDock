import { execFile } from 'child_process'
import type { PortProcess } from '@shared/types'

export type Runner = (cmd: string, args: string[]) => Promise<string>
export type Killer = (pid: number, signal: NodeJS.Signals) => void
export type Sleeper = (ms: number) => Promise<void>
export type AliveCheck = (pid: number) => boolean

const defaultRunner: Runner = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000 }, (_err, stdout) => resolve(stdout ?? ''))
  })

const defaultKiller: Killer = (pid, signal) => {
  try {
    process.kill(pid, signal)
  } catch {
    /* 进程可能已退出 */
  }
}

const defaultSleeper: Sleeper = (ms) => new Promise((r) => setTimeout(r, ms))

// signal 0 不发送信号，仅用于探测进程是否存在
const defaultAlive: AliveCheck = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM' // 存在但无权限
  }
}

// 解析 `lsof -nP -iTCP:<port> -sTCP:LISTEN` 输出，按 pid 去重
export function parseLsof(output: string): PortProcess[] {
  const out: PortProcess[] = []
  const seen = new Set<number>()
  for (const line of output.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 2) continue
    const pid = Number(cols[1])
    if (!Number.isInteger(pid) || pid <= 0 || seen.has(pid)) continue
    seen.add(pid)
    out.push({ pid, command: cols[0] })
  }
  return out
}

export class PortService {
  constructor(
    private readonly run: Runner = defaultRunner,
    private readonly kill: Killer = defaultKiller,
    private readonly sleep: Sleeper = defaultSleeper,
    private readonly alive: AliveCheck = defaultAlive
  ) {}

  // 谁在监听这个端口
  async whoListens(port: number): Promise<PortProcess[]> {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return []
    const out = await this.run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'])
    return parseLsof(out)
  }

  // 释放端口：对监听进程先 SIGTERM，残留再 SIGKILL，返回被处理的 pid
  async killPort(port: number): Promise<number[]> {
    const procs = await this.whoListens(port)
    if (procs.length === 0) return []
    const pids = procs.map((p) => p.pid)
    for (const pid of pids) this.kill(pid, 'SIGTERM')
    await this.sleep(400)
    const survivors = (await this.whoListens(port)).map((p) => p.pid)
    for (const pid of survivors) this.kill(pid, 'SIGKILL')
    if (survivors.length) await this.sleep(200)
    return pids
  }

  // 终止单个进程：先 SIGTERM，仍存活再 SIGKILL，返回是否已不存在
  async killPid(pid: number): Promise<boolean> {
    if (!Number.isInteger(pid) || pid <= 0) return false
    this.kill(pid, 'SIGTERM')
    await this.sleep(400)
    if (this.alive(pid)) {
      this.kill(pid, 'SIGKILL')
      await this.sleep(150)
    }
    return !this.alive(pid)
  }
}
