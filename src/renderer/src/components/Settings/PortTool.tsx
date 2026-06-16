import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, Plug } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { PortProcess } from '@shared/types'

export function PortTool(): JSX.Element {
  const [port, setPort] = useState('')
  const [procs, setProcs] = useState<PortProcess[] | null>(null) // null = 尚未查询
  const [loading, setLoading] = useState(false)
  const [killing, setKilling] = useState<number | null>(null)
  const reqId = useRef(0)

  const portNum = parseInt(port, 10)
  const valid = portNum >= 1 && portNum <= 65535

  async function query(p: number, showLoading = true): Promise<void> {
    const id = ++reqId.current
    if (showLoading) setLoading(true)
    const result = await window.devdock.ports.who(p)
    if (id !== reqId.current) return // 丢弃过期请求
    setProcs(result)
    setLoading(false)
  }

  // 输入防抖后实时查询占用
  useEffect(() => {
    if (!valid) {
      reqId.current++ // 取消在途请求
      setProcs(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(() => query(portNum), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port])

  async function kill(p: PortProcess): Promise<void> {
    setKilling(p.pid)
    const ok = await window.devdock.ports.killPid(p.pid)
    setKilling(null)
    if (valid) await query(portNum, false)
    const { toast } = await import('sonner')
    if (ok) toast.success(`已终止 ${p.command}`, { description: `PID ${p.pid}` })
    else toast.error(`无法终止 PID ${p.pid}`, { description: '可能需要更高权限' })
  }

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="number"
          inputMode="numeric"
          placeholder="输入端口号，如 5173"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="h-8 pl-8 pr-8 font-mono text-[13px]"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {!valid && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground/70">
          <Plug className="h-3.5 w-3.5" />
          输入端口号实时查看占用进程
        </div>
      )}

      {valid && procs !== null && procs.length === 0 && !loading && (
        <p className="py-2 text-center text-[11px] text-muted-foreground">
          端口 {portNum} 未被占用
        </p>
      )}

      {valid && procs !== null && procs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
          {procs.map((p, i) => (
            <div
              key={p.pid}
              className={cn(
                'flex items-center gap-2 px-2.5 py-2',
                i > 0 && 'border-t border-border/50'
              )}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-run glow-run" />
              <span className="truncate text-[12px] text-foreground" title={p.command}>
                {p.command}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                PID {p.pid}
              </span>
              <button
                onClick={() => kill(p)}
                disabled={killing !== null}
                aria-label={`终止 ${p.command}（PID ${p.pid}）`}
                title="终止此进程"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
              >
                {killing === p.pid ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
