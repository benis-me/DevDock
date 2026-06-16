import { describe, it, expect, vi } from 'vitest'
import { parseLsof, PortService } from './PortService'

const LSOF_OUTPUT = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    12345 pennli   23u  IPv4 0x1234      0t0  TCP *:5173 (LISTEN)
node    12345 pennli   24u  IPv6 0x5678      0t0  TCP [::1]:5173 (LISTEN)
Python  67890 pennli   3u   IPv4 0x9abc      0t0  TCP 127.0.0.1:5173 (LISTEN)
`

describe('parseLsof', () => {
  it('parses pid + command and dedupes by pid', () => {
    const procs = parseLsof(LSOF_OUTPUT)
    expect(procs).toEqual([
      { pid: 12345, command: 'node' },
      { pid: 67890, command: 'Python' }
    ])
  })
  it('returns [] for empty output', () => {
    expect(parseLsof('')).toEqual([])
  })
})

describe('PortService', () => {
  const noSleep = () => Promise.resolve()

  it('whoListens runs lsof and parses', async () => {
    const run = vi.fn().mockResolvedValue(LSOF_OUTPUT)
    const svc = new PortService(run, () => {}, noSleep)
    const procs = await svc.whoListens(5173)
    expect(run).toHaveBeenCalledWith('lsof', ['-nP', '-iTCP:5173', '-sTCP:LISTEN'])
    expect(procs.map((p) => p.pid)).toEqual([12345, 67890])
  })

  it('whoListens rejects invalid ports without running lsof', async () => {
    const run = vi.fn()
    const svc = new PortService(run, () => {}, noSleep)
    expect(await svc.whoListens(0)).toEqual([])
    expect(await svc.whoListens(70000)).toEqual([])
    expect(run).not.toHaveBeenCalled()
  })

  it('killPort SIGTERMs listeners then returns their pids when they die', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(LSOF_OUTPUT) // first whoListens → two pids
      .mockResolvedValueOnce('') // recheck → all gone
    const kill = vi.fn()
    const svc = new PortService(run, kill, noSleep)
    const killed = await svc.killPort(5173)
    expect(killed).toEqual([12345, 67890])
    expect(kill).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(kill).toHaveBeenCalledWith(67890, 'SIGTERM')
    expect(kill).not.toHaveBeenCalledWith(12345, 'SIGKILL')
  })

  it('killPort escalates to SIGKILL for survivors', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(LSOF_OUTPUT) // first whoListens
      .mockResolvedValueOnce(LSOF_OUTPUT) // recheck → still there
    const kill = vi.fn()
    const svc = new PortService(run, kill, noSleep)
    await svc.killPort(5173)
    expect(kill).toHaveBeenCalledWith(12345, 'SIGKILL')
    expect(kill).toHaveBeenCalledWith(67890, 'SIGKILL')
  })

  it('killPort is a no-op when nothing is listening', async () => {
    const run = vi.fn().mockResolvedValue('')
    const kill = vi.fn()
    const svc = new PortService(run, kill, noSleep)
    expect(await svc.killPort(5173)).toEqual([])
    expect(kill).not.toHaveBeenCalled()
  })
})
