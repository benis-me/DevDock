import { describe, it, expect } from 'vitest'
import { diffScripts } from './scriptDiff'
import type { WorkspacePkg } from '@shared/types'

function ws(scripts: Array<[string, string]>): WorkspacePkg[] {
  return [
    {
      name: 'app',
      relPath: '.',
      scripts: scripts.map(([name, command]) => ({
        id: `.#${name}`,
        name,
        command,
        kind: 'one-shot' as const,
        cwd: '/x'
      }))
    }
  ]
}

describe('diffScripts', () => {
  it('detects added, removed and changed scripts by id and command', () => {
    const before = ws([['dev', 'vite'], ['build', 'vite build'], ['lint', 'eslint .']])
    const after = ws([['dev', 'vite --host'], ['build', 'vite build'], ['test', 'vitest']])
    const d = diffScripts(before, after)
    expect(d.added).toEqual(['.#test'])
    expect(d.removed).toEqual(['.#lint'])
    expect(d.changed).toEqual(['.#dev'])
  })

  it('returns empty diff when identical', () => {
    const a = ws([['dev', 'vite']])
    const d = diffScripts(a, ws([['dev', 'vite']]))
    expect(d).toEqual({ added: [], removed: [], changed: [] })
  })
})
