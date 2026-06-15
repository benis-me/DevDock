import { existsSync } from 'fs'
import { join } from 'path'
import type { PackageManager } from '@shared/types'

export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
  // bun 1.2+ 用文本 bun.lock；旧版用二进制 bun.lockb，两者都要识别
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun'
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm'
  return 'npm'
}
