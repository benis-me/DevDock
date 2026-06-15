import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export function TerminalView({ sessionKey, visible }: { sessionKey: string; visible: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      cursorBlink: true,
      theme: { background: '#00000000' },
      allowTransparency: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(
      new WebLinksAddon((_e, uri) => window.devdock.shell.openExternal(uri))
    )
    term.open(ref.current!)
    termRef.current = term
    fitRef.current = fit

    // 回填历史缓冲
    window.devdock.terminal.getBuffer(sessionKey).then((buf) => {
      if (buf) term.write(buf)
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
      off()
      onInput.dispose()
      ro.disconnect()
      term.dispose()
    }
  }, [sessionKey])

  useEffect(() => {
    if (visible) setTimeout(() => fitRef.current?.fit(), 0)
  }, [visible])

  return <div ref={ref} className="h-full w-full" style={{ display: visible ? 'block' : 'none' }} />
}
