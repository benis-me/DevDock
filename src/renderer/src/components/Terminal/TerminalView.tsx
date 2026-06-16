import type { JSX, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Search, Copy, Trash2, ArrowDown, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import '@xterm/xterm/css/xterm.css'

// background 必须与 globals.css 的 --term-bg 一致（DOM 底色靠该 CSS 变量自动跟随主题）
const TERMINAL_THEME_DARK: ITheme = {
  background: '#0d0d0d',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#0d0d0d',
  selectionBackground: '#2a2a2a',
  black: '#404040',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#d4d4d4',
  brightBlack: '#6b6b6b',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f4f4f4'
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

function ToolBtn({
  title,
  onClick,
  children
}: {
  title: string
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
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
  const searchRef = useRef<SearchAddon | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fontSize = useAppStore((s) => s.settings.terminalFontSize)
  const cursorBlink = useAppStore((s) => s.settings.terminalCursorBlink)
  const isDark = useAppStore((s) => s.isDark)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [atBottom, setAtBottom] = useState(true)

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
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(search)
    term.loadAddon(new WebLinksAddon((_e, uri) => window.devdock.shell.openExternal(uri)))
    term.open(ref.current!)
    termRef.current = term
    fitRef.current = fit
    searchRef.current = search

    const updateBottom = (): void =>
      setAtBottom(term.buffer.active.viewportY >= term.buffer.active.baseY)

    window.devdock.terminal.getBuffer(sessionKey).then((buf) => {
      if (!disposed && buf) term.write(buf, updateBottom)
    })

    const off = window.devdock.onTerminalData((key, chunk) => {
      if (key === sessionKey) term.write(chunk, updateBottom)
    })
    const onInput = term.onData((data) => window.devdock.terminal.write(sessionKey, data))
    const onScroll = term.onScroll(updateBottom)

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
      onScroll.dispose()
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

  const findNext = (q = searchTerm): void => {
    if (q) searchRef.current?.findNext(q)
  }
  const findPrev = (): void => {
    if (searchTerm) searchRef.current?.findPrevious(searchTerm)
  }
  const closeSearch = (): void => {
    setSearchOpen(false)
    termRef.current?.clearSelection()
    termRef.current?.focus()
  }
  const openSearch = (): void => {
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }
  const copyAll = async (): Promise<void> => {
    const term = termRef.current
    if (!term) return
    term.selectAll()
    const text = term.getSelection()
    term.clearSelection()
    if (!text) return
    await navigator.clipboard.writeText(text)
    import('sonner').then(({ toast }) => toast.success('已复制终端内容'))
  }
  const clearTerm = (): void => {
    termRef.current?.clear()
    window.devdock.terminal.clear(sessionKey)
  }

  return (
    <div
      className="group relative h-full w-full bg-[var(--term-bg)] p-2.5"
      style={{ display: visible ? 'block' : 'none' }}
      onKeyDownCapture={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault()
          e.stopPropagation()
          openSearch()
        }
      }}
    >
      <div ref={ref} className="h-full w-full" />

      {searchOpen ? (
        <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-1 shadow-sm backdrop-blur-sm">
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              findNext(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.shiftKey ? findPrev() : findNext()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                closeSearch()
              }
            }}
            placeholder="搜索输出…"
            className="h-6 w-40 bg-transparent px-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <ToolBtn title="上一个 (⇧⏎)" onClick={findPrev}>
            <ChevronUp className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="下一个 (⏎)" onClick={() => findNext()}>
            <ChevronDown className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="关闭 (Esc)" onClick={closeSearch}>
            <X className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
      ) : (
        <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-md border border-border bg-background/80 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <ToolBtn title="搜索 (⌘F)" onClick={openSearch}>
            <Search className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="复制全部" onClick={copyAll}>
            <Copy className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="清屏" onClick={clearTerm}>
            <Trash2 className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>
      )}

      {!atBottom && (
        <button
          onClick={() => termRef.current?.scrollToBottom()}
          title="跳到底部"
          aria-label="跳到底部"
          className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:text-foreground"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
