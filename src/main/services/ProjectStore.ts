import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { dirname } from 'path'
import { DEFAULT_CONFIG, CONFIG_VERSION, type Config } from '@shared/types'

export class ProjectStore {
  constructor(private readonly filePath: string) {}

  load(): Config {
    if (!existsSync(this.filePath)) return structuredClone(DEFAULT_CONFIG)
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Config
      return this.migrate(parsed)
    } catch {
      renameSync(this.filePath, this.filePath + '.bak')
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  save(config: Config): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf8')
  }

  private migrate(config: Config): Config {
    // 版本迁移占位：当前仅有 v1
    if (!config.version || config.version < CONFIG_VERSION) {
      return { ...structuredClone(DEFAULT_CONFIG), ...config, version: CONFIG_VERSION }
    }
    return config
  }
}
