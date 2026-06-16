import type { ScriptKind, SessionState, SessionStatus } from '@shared/types'

export interface NotifyDecision {
  kind: 'error' | 'success'
  title: string
}

// 判断某次状态变化是否需要发通知（纯函数，便于测试）
// - 任何脚本进入 errored → 异常通知
// - 一次性任务干净退出（exitCode 0）→ 完成通知
// - 长任务的 exited（多为用户手动停止）不通知
export function notifyDecision(
  prev: SessionStatus | undefined,
  next: SessionState,
  scriptKind: ScriptKind | undefined
): NotifyDecision | null {
  if (prev === next.status) return null // 非状态切换
  if (next.status === 'errored') return { kind: 'error', title: '脚本异常退出' }
  if (next.status === 'exited' && scriptKind === 'one-shot' && next.exitCode === 0) {
    return { kind: 'success', title: '任务完成' }
  }
  return null
}
