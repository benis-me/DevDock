import { describe, it, expect, vi } from 'vitest'
import { parsePorcelain, parseAheadBehind, GitService, type GitRunner } from './GitService'

describe('parsePorcelain', () => {
  it('counts changed files', () => {
    expect(parsePorcelain(' M a.ts\n?? b.ts\n')).toBe(2)
    expect(parsePorcelain('')).toBe(0)
    expect(parsePorcelain('\n\n')).toBe(0)
  })
})

describe('parseAheadBehind', () => {
  it('parses behind/ahead pair', () => {
    expect(parseAheadBehind('2\t3\n')).toEqual({ behind: 2, ahead: 3 })
    expect(parseAheadBehind('0 0')).toEqual({ behind: 0, ahead: 0 })
  })
  it('defaults to zero when no upstream', () => {
    expect(parseAheadBehind('fatal: no upstream')).toEqual({ behind: 0, ahead: 0 })
  })
})

describe('GitService.info', () => {
  function runner(map: Record<string, { ok?: boolean; out?: string }>): GitRunner {
    return vi.fn(async (args) => {
      const key = args[0]
      const r = map[key] ?? { ok: true, out: '' }
      return { ok: r.ok ?? true, out: r.out ?? '' }
    })
  }

  it('returns null for a non-git directory', async () => {
    const svc = new GitService(runner({ 'rev-parse': { ok: false, out: '' } }))
    expect(await svc.info('/tmp/x')).toBeNull()
  })

  it('reports branch, dirty and ahead/behind', async () => {
    const svc = new GitService(
      runner({
        'rev-parse': { out: 'true\n' },
        branch: { out: 'main\n' },
        status: { out: ' M a.ts\n?? b.ts\n' },
        'rev-list': { out: '1\t4\n' }
      })
    )
    expect(await svc.info('/repo')).toEqual({
      branch: 'main',
      dirty: true,
      changes: 2,
      ahead: 4,
      behind: 1
    })
  })

  it('clean repo on a branch with no upstream', async () => {
    const svc = new GitService(
      runner({
        'rev-parse': { out: 'true' },
        branch: { out: 'feature\n' },
        status: { out: '' },
        'rev-list': { ok: false, out: '' }
      })
    )
    expect(await svc.info('/repo')).toEqual({
      branch: 'feature',
      dirty: false,
      changes: 0,
      ahead: 0,
      behind: 0
    })
  })
})
