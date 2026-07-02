// Postinstall hook:
// 1. Ensure Electron's binary is downloaded (Bun can skip electron's own postinstall).
// 2. macOS only: re-sign native binaries whose ad-hoc signature was invalidated by
//    package extraction, and restore executable bits on helpers like node-pty's spawn-helper.
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function ensureElectron() {
  const electronDir = join(root, 'node_modules', 'electron')
  const installScript = join(electronDir, 'install.js')
  const pathFile = join(electronDir, 'path.txt')

  if (!existsSync(installScript)) return

  let needsDownload = !existsSync(pathFile)
  if (!needsDownload) {
    const executablePath = readFileSync(pathFile, 'utf8').trim()
    needsDownload = !existsSync(join(electronDir, 'dist', executablePath))
  }

  if (!needsDownload) return

  console.log('[postinstall] downloading Electron binary...')
  const result = spawnSync(process.execPath, [installScript], { stdio: 'inherit', cwd: root })
  if (result.status !== 0) {
    console.warn(
      '[postinstall] Electron download failed — run `node node_modules/electron/install.js` manually'
    )
  }
}

function fixNativeSign() {
  if (platform() !== 'darwin') return

  const EXECUTABLES = new Set(['spawn-helper'])

  try {
    const files = execSync(
      'find node_modules \\( -name "*.node" -o -name esbuild -o -name spawn-helper \\) -type f',
      {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      }
    )
      .split('\n')
      .filter(Boolean)

    let signed = 0
    for (const f of files) {
      try {
        if (EXECUTABLES.has(f.split('/').pop())) {
          spawnSync('chmod', ['+x', f])
        }
        execSync(`xattr -c "${f}" 2>/dev/null; codesign --force --sign - "${f}"`, { stdio: 'ignore' })
        signed++
      } catch {
        // ignore per-file failures (e.g. non-darwin .node files that can't be signed)
      }
    }
    console.log(`[postinstall] re-signed ${signed}/${files.length} native binaries`)
  } catch (err) {
    console.warn('[postinstall] native sign skipped:', err instanceof Error ? err.message : err)
  }
}

ensureElectron()
fixNativeSign()
