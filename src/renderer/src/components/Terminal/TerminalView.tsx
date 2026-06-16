import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '@/store/useAppStore'
import '@xterm/xterm/css/xterm.css'

// background 必须与 globals.css 的 --term-bg 一致（DOM 底色靠该 CSS 变量自动跟随主题）
const TERMINAL_THEME_DARK: ITheme = {
  background: '#0c0f16',
  foreground: '#d4d6dc',
  cursor: '#d4d6dc',
  cursorAccent: '#0c0f16',
  selectionBackground: '#2c2f36',
  black: '#3b3f47',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#d4d6dc',
  brightBlack: '#6b7280',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f3f4f6'
}

const TERMINAL_THEME_LIGHT: ITheme = {
  background: '#ffffff',
  foreground: '#1f2328',
  cursor: '#1f2328',
  cursorAccent: '#ffffff',
  selectionBackground: '#d7d9dc',
  black: '#24292f',
  red: '#cf222e',
  green: '#116329',
  yellow: '#9a6700',
  blue: '#0969da',
  magenta: '#8250df',
  cyan: '#1b7c83',
  white: '#6e7781',
  brightBlack: '#57606a',
  brightRed: '#a40e26',
  brightGreen: '#1a7f37',
  brightYellow: '#633c01',
  brightBlue: '#218bff',
  brightMagenta: '#a475f9',
  brightCyan: '#3192aa',
  brightWhite: '#8c959f'
}

const termTheme = (isDark: boolean): ITheme => (isDark ? TERMINAL_THEME_DARK : TERMINAL_THEME_LIGHT)

export function TerminalView({
  sessionKey,
  visible
}: {
  sessionKey: string
  visible: boolean
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const fontSize = useAppStore((s) => s.settings.terminalFontSize)
  const cursorBlink = useAppStore((s) => s.settings.terminalCursorBlink)
  const isDark = useAppStore((s) => s.isDark)

  useEffect(() => {
    let disposed = false
    const s = useAppStore.getState().settings

    const term = new Terminal({
      fontFamily:
        '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: s.terminalFontSize,
      lineHeight: 1.35,
      cursorBlink: s.terminalCursorBlink,
      scrollback: 5000,
      theme: termTheme(useAppStore.getState().isDark)
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon((_e, uri) => window.devdock.shell.openExternal(uri)))
    term.open(ref.current!)
    termRef.current = term
    fitRef.current = fit

    window.devdock.terminal.getBuffer(sessionKey).then((buf) => {
      if (!disposed && buf) term.write(buf)
    })

    const off = window.devdock.onTerminalData((key, chunk) => {
      if (key === sessionKey) term.write(chunk)
    })
    const onInput = term.onData((data) => window.devdock.terminal.write(sessionKey, data))

    const doFit = (): void => {
      try {
        fit.fit()
        window.devdock.terminal.resize(sessionKey, term.cols, term.rows)
      } catch {
        /* element not visible yet */
      }
    }
    const ro = new ResizeObserver(doFit)
    ro.observe(ref.current!)
    setTimeout(doFit, 0)

    return () => {
      disposed = true
      off()
      onInput.dispose()
      ro.disconnect()
      term.dispose()
    }
  }, [sessionKey])

  useEffect(() => {
    if (visible) setTimeout(() => fitRef.current?.fit(), 0)
  }, [visible])

  // 主题明暗变化时切换终端配色
  useEffect(() => {
    const term = termRef.current
    if (term) term.options.theme = termTheme(isDark)
  }, [isDark])

  // 设置项变化时即时应用到已存在的终端
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontSize = fontSize
    term.options.cursorBlink = cursorBlink
    setTimeout(() => {
      try {
        fitRef.current?.fit()
        window.devdock.terminal.resize(sessionKey, term.cols, term.rows)
      } catch {
        /* 元素尚不可见 */
      }
    }, 0)
  }, [fontSize, cursorBlink, sessionKey])

  return (
    <div
      className="h-full w-full bg-[var(--term-bg)] p-2.5"
      style={{ display: visible ? 'block' : 'none' }}
    >
      <div ref={ref} className="h-full w-full" />
    </div>
  )
}
