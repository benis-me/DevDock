import type { PackageManager } from './types'

export function sessionKey(projectId: string, scriptId: string): string {
  return `${projectId}::${scriptId}`
}

export function runCommand(pm: PackageManager, scriptName: string): string {
  switch (pm) {
    case 'yarn':
      return `yarn ${scriptName}`
    case 'pnpm':
      return `pnpm run ${scriptName}`
    case 'bun':
      return `bun run ${scriptName}`
    default:
      return `npm run ${scriptName}`
  }
}
