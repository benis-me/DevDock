import { execFile } from 'child_process'
import type { GitInfo } from '@shared/types'

export type GitRunner = (args: string[], cwd: string) => Promise<{ ok: boolean; out: string }>

const defaultRunner: GitRunner = (args, cwd) =>
  new Promise((resolve) => {
    execFile('git', ['-C', cwd, ...args], { timeout: 4000 }, (err, stdout) => {
      resolve({ ok: !err, out: (stdout ?? '').toString() })
    })
  })

// `git status --porcelain` 的行数 = 改动文件数
export function parsePorcelain(out: string): number {
  return out.split(/\r?\n/).filter((l) => l.trim().length > 0).length
}

// `git rev-list --count --left-right @{upstream}...HEAD` → "<behind>\t<ahead>"
export function parseAheadBehind(out: string): { ahead: number; behind: number } {
  const m = out.trim().match(/^(\d+)\s+(\d+)$/)
  if (!m) return { ahead: 0, behind: 0 }
  return { behind: Number(m[1]), ahead: Number(m[2]) }
}

export class GitService {
  constructor(private readonly run: GitRunner = defaultRunner) {}

  // 非 git 仓库返回 null
  async info(cwd: string): Promise<GitInfo | null> {
    const inside = await this.run(['rev-parse', '--is-inside-work-tree'], cwd)
    if (!inside.ok || inside.out.trim() !== 'true') return null
    const [branchR, statusR, abR] = await Promise.all([
      this.run(['branch', '--show-current'], cwd),
      this.run(['status', '--porcelain'], cwd),
      this.run(['rev-list', '--count', '--left-right', '@{upstream}...HEAD'], cwd)
    ])
    const branch = branchR.ok ? branchR.out.trim() || null : null
    const changes = statusR.ok ? parsePorcelain(statusR.out) : 0
    const { ahead, behind } = abR.ok ? parseAheadBehind(abR.out) : { ahead: 0, behind: 0 }
    return { branch, dirty: changes > 0, changes, ahead, behind }
  }
}
