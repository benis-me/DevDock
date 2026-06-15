import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useAppStore } from '@/store/useAppStore'
import '@xterm/xterm/css/xterm.css'

const DARK_THEME = {
  background: '#00000000',
  foreground: '#d4d6dc',
  cursor: '#9aa0aa',
  cursorAccent: '#1c1d22',
  selectionBackground: '#3a4150',
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

const LIGHT_THEME = {
  background: '#00000000',
  foreground: '#3a3f47',
  cursor: '#6b7280',
  cursorAccent: '#ffffff',
  selectionBackground: '#cdd8ef',
  black: '#3b3f47',
  red: '#dc2626',
  green: '#059669',
  yellow: '#b45309',
  blue: '#2563eb',
  magenta: '#7c3aed',
  cyan: '#0891b2',
  white: '#d4d6dc',
  brightBlack: '#9ca3af',
  brightRed: '#ef4444',
  brightGreen: '#10b981',
  brightYellow: '#d97706',
  brightBlue: '#3b82f6',
  brightMagenta: '#8b5cf6',
  brightCyan: '#06b6d4',
  brightWhite: '#111827'
}

function currentTheme(): ITheme {
  return document.documentElement.classList.contains('dark') ? DARK_THEME : LIGHT_THEME
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
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    let disposed = false

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 5000,
      theme: currentTheme()
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

  // keep the terminal palette in sync with light/dark theme
  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = currentTheme()
  }, [theme])

  useEffect(() => {
    if (visible) setTimeout(() => fitRef.current?.fit(), 0)
  }, [visible])

  return (
    <div ref={ref} className="h-full w-full" style={{ display: visible ? 'block' : 'none' }} />
  )
}
