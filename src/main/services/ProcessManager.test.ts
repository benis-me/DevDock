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

  it('marks errored on a non-zero crash exit (no stop requested)', () => {
    const fake = makeFakePty()
    const pm = new ProcessManager(() => fake.pty)
    pm.start({ scriptId: '.#build', command: 'x', cwd: '/x' })
    fake.emitExit(1)
    const st = pm.getState('.#build')
    expect(st?.status).toBe('errored')
    expect(st?.exitCode).toBe(1)
  })

  it('marks exited on a clean (zero) exit', () => {
    const fake = makeFakePty()
    const pm = new ProcessManager(() => fake.pty)
    pm.start({ scriptId: '.#build', command: 'x', cwd: '/x' })
    fake.emitExit(0)
    expect(pm.getState('.#build')?.status).toBe('exited')
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
