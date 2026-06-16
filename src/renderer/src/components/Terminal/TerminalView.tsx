import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '@/store/useAppStore'
import '@xterm/xterm/css/xterm.css'

export const TERMINAL_BG = '#0c0f16'

const TERMINAL_THEME: ITheme = {
  background: TERMINAL_BG,
  foreground: '#d4d6dc',
  cursor: '#d4d6dc',
  cursorAccent: TERMINAL_BG,
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
      theme: TERMINAL_THEME
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
      className="h-full w-full p-2.5"
      style={{ background: TERMINAL_BG, display: visible ? 'block' : 'none' }}
    >
      <div ref={ref} className="h-full w-full" />
    </div>
  )
}
