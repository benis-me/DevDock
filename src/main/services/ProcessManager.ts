import { EventEmitter } from 'events'
import type { SessionState, SessionStatus } from '@shared/types'
import { detectUrl, stripAnsi } from './UrlDetector'
import { detectPortConflict } from '@shared/port'
import { realPtySpawner, type IPty, type PtySpawner } from './ptySpawner'

interface Session {
  state: SessionState
  pty: IPty
  buffer: string
  command: string
  cwd: string
  stopRequested: boolean
  killTimer?: NodeJS.Timeout
  conflictPort?: number // 已就该端口冲突告警过，避免重复
}

const BUFFER_LIMIT = 200_000

const NOOP_PTY: IPty = {
  pid: -1,
  onData: () => {},
  onExit: () => {},
  write: () => {},
  resize: () => {},
  kill: () => {}
}

export interface StartOptions {
  scriptId: string
  command: string
  cwd: string
  env?: NodeJS.ProcessEnv
  url?: string // 预设网址（如 portless 的 *.localhost），设置后跳过输出解析
}

export class ProcessManager extends EventEmitter {
  private sessions = new Map<string, Session>()

  constructor(private readonly spawner: PtySpawner = realPtySpawner) {
    super()
  }

  start(opts: StartOptions): void {
    this.stop(opts.scriptId) // 重启幂等
    let pty: IPty
    try {
      pty = this.spawner(opts.command, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env, FORCE_COLOR: '1' },
        cols: 80,
        rows: 24
      })
    } catch (err) {
      const message = `\r\n[DevDock] 无法启动：${(err as Error)?.message ?? String(err)}\r\n`
      const state: SessionState = {
        scriptId: opts.scriptId,
        pid: -1,
        status: 'errored',
        startedAt: Date.now()
      }
      this.sessions.set(opts.scriptId, {
        state,
        pty: NOOP_PTY,
        buffer: message,
        command: opts.command,
        cwd: opts.cwd,
        stopRequested: false
      })
      this.emit('data', opts.scriptId, message)
      this.emit('status', { ...state })
      return
    }

    const state: SessionState = {
      scriptId: opts.scriptId,
      pid: pty.pid,
      status: 'starting',
      startedAt: Date.now()
    }
    const session: Session = { state, pty, buffer: '', command: opts.command, cwd: opts.cwd, stopRequested: false }
    this.sessions.set(opts.scriptId, session)
    this.emit('status', { ...state })

    pty.onData((data) => {
      session.buffer = (session.buffer + data).slice(-BUFFER_LIMIT)
      this.emit('data', opts.scriptId, data)
      if (session.state.status === 'starting') {
        session.state.status = 'running'
        this.emit('status', { ...session.state })
        if (opts.url && !session.state.url) {
          session.state.url = opts.url
          this.emit('url', opts.scriptId, opts.url)
        }
      }
      if (!session.state.url) {
        const url = detectUrl(data)
        if (url) {
          session.state.url = url
          this.emit('url', opts.scriptId, url)
        }
      }
      const port = detectPortConflict(stripAnsi(data))
      if (port && session.conflictPort !== port) {
        session.conflictPort = port
        this.emit('port:conflict', opts.scriptId, port)
      }
    })

    pty.onExit(({ exitCode }) => {
      if (session.killTimer) {
        clearTimeout(session.killTimer)
        session.killTimer = undefined
      }
      session.state.status = session.stopRequested || exitCode === 0 ? 'exited' : 'errored'
      session.state.exitCode = exitCode
      session.state.url = undefined
      const note = `\r\n\x1b[2m── DevDock：进程已结束（退出码 ${exitCode}）──\x1b[0m\r\n`
      session.buffer = (session.buffer + note).slice(-BUFFER_LIMIT)
      this.emit('data', opts.scriptId, note)
      this.emit('status', { ...session.state })
    })
  }

  stop(scriptId: string): void {
    const s = this.sessions.get(scriptId)
    if (!s) return
    if (s.state.status === 'starting' || s.state.status === 'running') {
      s.stopRequested = true
      s.killTimer = setTimeout(() => {
        try {
          s.pty.kill('SIGKILL')
        } catch {
          /* already gone */
        }
      }, 5000)
      try {
        s.pty.kill('SIGTERM')
      } catch {
        /* already dead */
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

  clearBuffer(scriptId: string): void {
    const s = this.sessions.get(scriptId)
    if (s) s.buffer = ''
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
