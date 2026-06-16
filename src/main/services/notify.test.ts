import { describe, it, expect } from 'vitest'
import { notifyDecision } from './notify'
import type { SessionState } from '@shared/types'

function st(status: SessionState['status'], exitCode?: number): SessionState {
  return { scriptId: 'p::s', pid: 1, status, startedAt: 0, exitCode }
}

describe('notifyDecision', () => {
  it('notifies on entering errored', () => {
    expect(notifyDecision('running', st('errored', 1), 'long-running')?.kind).toBe('error')
    expect(notifyDecision('starting', st('errored', 1), 'one-shot')?.kind).toBe('error')
  })

  it('notifies success when a one-shot task exits cleanly', () => {
    expect(notifyDecision('running', st('exited', 0), 'one-shot')?.kind).toBe('success')
  })

  it('does not notify for a long-running script that exits (user stop)', () => {
    expect(notifyDecision('running', st('exited', 0), 'long-running')).toBeNull()
  })

  it('does not notify for a one-shot exiting non-zero (that path is errored)', () => {
    expect(notifyDecision('running', st('exited', 2), 'one-shot')).toBeNull()
  })

  it('ignores non-transitions and normal lifecycle states', () => {
    expect(notifyDecision('errored', st('errored', 1), 'one-shot')).toBeNull()
    expect(notifyDecision('starting', st('running'), 'long-running')).toBeNull()
    expect(notifyDecision(undefined, st('starting'), 'long-running')).toBeNull()
  })
})
