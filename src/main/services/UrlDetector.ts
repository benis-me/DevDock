// 同时匹配 CSI（[…）与 OSC（]…，含终端超链接）转义序列；ESC 必须存在
const ANSI_REGEX = new RegExp(
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  'g'
)

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
