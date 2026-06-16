import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { tags as t } from '@lezer/highlight'
import { cn } from '@/lib/utils'
import { FileCog, Save, RotateCcw } from 'lucide-react'

function fileName(p: string): string {
  return p.split('/').pop() ?? p
}

// 纯黑白灰语法高亮：注释弱化，键名加重，值用前景色
const monoHighlight = HighlightStyle.define([
  { tag: t.comment, color: 'var(--color-muted-foreground)', fontStyle: 'italic' },
  {
    tag: [t.propertyName, t.definition(t.variableName), t.variableName, t.keyword, t.attributeName],
    color: 'var(--color-foreground)',
    fontWeight: '500'
  },
  {
    tag: [t.string, t.atom, t.literal, t.number, t.bool, t.operator, t.attributeValue],
    color: 'var(--color-foreground)'
  }
])

const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--color-foreground)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '12.5px', lineHeight: '1.7' },
  '.cm-content': { padding: '10px 0' },
  '.cm-line': { padding: '0 14px' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'color-mix(in oklab, var(--color-foreground) 30%, transparent)',
    border: 'none'
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklab, var(--color-foreground) 4%, transparent)'
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-foreground)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-foreground)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklab, var(--color-foreground) 16%, transparent)'
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in oklab, var(--color-foreground) 14%, transparent)',
    outline: 'none'
  }
})

export function EnvEditor({ path, visible }: { path: string; visible: boolean }): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const savedRef = useRef('')
  const [dirty, setDirty] = useState(false)
  const [externalChange, setExternalChange] = useState(false)

  const doSave = (): void => {
    const view = viewRef.current
    if (!view) return
    const content = view.state.doc.toString()
    window.devdock.env.write(path, content)
    savedRef.current = content
    setDirty(false)
    setExternalChange(false)
  }
  const saveRef = useRef(doSave)
  saveRef.current = doSave

  const replaceContent = (content: string): void => {
    const view = viewRef.current
    if (!view) return
    savedRef.current = content
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
    setDirty(false)
    setExternalChange(false)
  }

  const reloadFromDisk = (): void => {
    window.devdock.env.read(path).then(replaceContent)
  }

  // 切回该 tab 时让 CodeMirror 重新测量（display:none 期间无法布局）
  useEffect(() => {
    if (visible) setTimeout(() => viewRef.current?.requestMeasure(), 0)
  }, [visible])

  // mount / re-create the editor when the file changes
  useEffect(() => {
    let disposed = false
    setDirty(false)
    setExternalChange(false)
    window.devdock.env.read(path).then((content) => {
      if (disposed || !hostRef.current) return
      savedRef.current = content
      viewRef.current = new EditorView({
        parent: hostRef.current,
        state: EditorState.create({
          doc: content,
          extensions: [
            basicSetup,
            StreamLanguage.define(properties),
            syntaxHighlighting(monoHighlight),
            EditorView.lineWrapping,
            keymap.of([
              {
                key: 'Mod-s',
                preventDefault: true,
                run: () => {
                  saveRef.current()
                  return true
                }
              }
            ]),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) setDirty(u.state.doc.toString() !== savedRef.current)
            }),
            editorTheme
          ]
        })
      })
    })
    return () => {
      disposed = true
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [path])

  // react to external (on-disk) changes
  useEffect(() => {
    return window.devdock.onEnvChanged((changed) => {
      if (changed !== path) return
      const view = viewRef.current
      if (!view) return
      window.devdock.env.read(path).then((content) => {
        if (content === view.state.doc.toString()) return
        if (view.state.doc.toString() === savedRef.current) replaceContent(content)
        else setExternalChange(true)
      })
    })
  }, [path])

  return (
    <div
      className="h-full w-full flex-col overflow-hidden bg-background"
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <FileCog className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-mono text-xs text-foreground">{fileName(path)}</span>
        {dirty && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60"
            title="未保存的修改"
          />
        )}
        <div className="flex-1" />
        {externalChange && (
          <button
            onClick={reloadFromDisk}
            title="文件在磁盘上已更改，点击放弃当前修改并重新加载"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 磁盘已更改·重载
          </button>
        )}
        <button
          onClick={doSave}
          disabled={!dirty}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            dirty
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'cursor-default text-muted-foreground/40'
          )}
        >
          <Save className="h-3.5 w-3.5" /> 保存
        </button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  )
}
