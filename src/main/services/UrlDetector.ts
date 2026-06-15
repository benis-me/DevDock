// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /(\x1b|)[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\[(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[mGKHF]/g

const URL_REGEX =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[\w.-]+\.localhost)(?::\d+)?(?:\/[^\s]*)?/gi

export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}

export function detectUrl(input: string): string | null {
  const text = stripAnsi(input)
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (/local/i.test(line)) {
      const m = line.match(URL_REGEX)
      if (m && m.length) return m[0]
    }
  }
  const all = text.match(URL_REGEX)
  return all && all.length ? all[0] : null
}
