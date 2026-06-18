// macOS only. Bun's package extraction can invalidate the ad-hoc code signature
// of prebuilt native binaries (esbuild, rollup, lightningcss, node-pty, ...).
// When that happens the kernel SIGKILLs them on exec — surfacing as exit code
// 137 or esbuild's "The service was stopped: write EPIPE". Re-signing with an
// ad-hoc signature fixes it. No-op on non-macOS platforms (Linux/Windows/CI).
import { execSync } from 'node:child_process'
import { platform } from 'node:os'

if (platform() !== 'darwin') process.exit(0)

try {
  const files = execSync('find node_modules \\( -name "*.node" -o -name esbuild \\) -type f', {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
    .split('\n')
    .filter(Boolean)

  let signed = 0
  for (const f of files) {
    try {
      execSync(`xattr -c "${f}" 2>/dev/null; codesign --force --sign - "${f}"`, { stdio: 'ignore' })
      signed++
    } catch {
      // ignore per-file failures (e.g. non-darwin .node files that can't be signed)
    }
  }
  console.log(`[fix-native-sign] re-signed ${signed}/${files.length} native binaries`)
} catch (err) {
  console.warn('[fix-native-sign] skipped:', err instanceof Error ? err.message : err)
}
