import type { WorkspacePkg, ScriptDef } from '@shared/types'

export interface ScriptDiff {
  added: string[]
  removed: string[]
  changed: string[]
}

function flatten(workspaces: WorkspacePkg[]): Map<string, ScriptDef> {
  const map = new Map<string, ScriptDef>()
  for (const ws of workspaces) for (const s of ws.scripts) map.set(s.id, s)
  return map
}

export function diffScripts(before: WorkspacePkg[], after: WorkspacePkg[]): ScriptDiff {
  const a = flatten(before)
  const b = flatten(after)
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const id of b.keys()) if (!a.has(id)) added.push(id)
  for (const id of a.keys()) if (!b.has(id)) removed.push(id)
  for (const [id, def] of a) {
    const next = b.get(id)
    if (next && next.command !== def.command) changed.push(id)
  }
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort()
  }
}
