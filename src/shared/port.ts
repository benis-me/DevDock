// 从一个 URL 中解析出显式端口（无端口或解析失败返回 null）
export function portFromUrl(url: string | undefined): number | null {
  if (!url) return null
  try {
    const p = new URL(url).port
    return p ? Number(p) : null
  } catch {
    return null
  }
}

// 从（已去除 ANSI 的）终端输出里识别"端口被占用"类错误，返回冲突端口号
const CONFLICT_PATTERNS: RegExp[] = [
  // node: EADDRINUSE: address already in use :::5173 / 127.0.0.1:5173
  /EADDRINUSE[^\n]*?(?:::::?|[\d.]*:)(\d{2,5})\b/i,
  // 通用: address already in use ...:5173
  /address already in use[^\n]*?:(\d{2,5})\b/i,
  // vite(strictPort)/通用: Port 5173 is (already) in use
  /\bport\s+(\d{2,5})\s+is\s+(?:already\s+)?in use/i,
  // CRA/webpack: Something is already running on port 3000
  /already running on port\s+(\d{2,5})/i
]

export function detectPortConflict(text: string): number | null {
  for (const re of CONFLICT_PATTERNS) {
    const m = text.match(re)
    if (m) {
      const n = Number(m[1])
      if (n > 0 && n <= 65535) return n
    }
  }
  return null
}
