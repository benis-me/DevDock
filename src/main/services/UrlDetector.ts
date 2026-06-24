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

// 一段输出里出现的所有服务链接（loopback / *.localhost；LAN 地址由 URL_REGEX
// 白名单天然排除）。去重与上限交给调用方（ProcessManager 按 origin 累积）。
export function detectUrls(input: string): string[] {
  const m = stripAnsi(input).match(URL_REGEX)
  return m ? [...m] : []
}
