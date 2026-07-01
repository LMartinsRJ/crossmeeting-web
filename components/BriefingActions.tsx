'use client'

import { useState, useCallback } from 'react'
import { DetailModal, EditModal } from '@/components/ActionsClient'
import type { ActionItem } from '@/components/ActionsClient'
import Link from 'next/link'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function dueStatus(due: string | null, doneAt: string | null) {
  if (doneAt) return 'done'
  if (!due) return 'pending'
  const t = todayStr()
  if (due < t) return 'overdue'
  if (due === t) return 'today'
  return 'pending'
}

function fmtShortDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function BriefingActions({
  initial,
  title,
  linkHref,
  linkLabel,
  maxVisible = 8,
}: {
  initial: ActionItem[]
  title: string
  linkHref?: string
  linkLabel?: string
  maxVisible?: number
}) {
  const [actions, setActions] = useState<ActionItem[]>(initial)
  const [detail, setDetail] = useState<ActionItem | null>(null)
  const [editing, setEditing] = useState<ActionItem | null>(null)

  const updateAction = useCallback((updated: ActionItem) => {
    setActions(prev => prev.map(a => a.id === updated.id ? updated : a))
    if (detail?.id === updated.id) setDetail(updated)
  }, [detail])

  const removeAction = useCallback((id: number) => {
    setActions(prev => prev.filter(a => a.id !== id))
    setDetail(null)
  }, [])

  const visible = actions.slice(0, maxVisible)
  const overflow = actions.length - maxVisible

  if (actions.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <p className="text-sm text-neutral-600">Nenhuma ação pendente.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</h2>
        {linkHref && (
          <Link href={linkHref} className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">
            {linkLabel ?? `${actions.length} ações →`}
          </Link>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden mb-6">
        {visible.map((action, i) => {
          const status = dueStatus(action.due_date, action.done_at)
          const isDone = action.status === 'concluida' || !!action.done_at
          const isLast = i === visible.length - 1 && overflow <= 0

          return (
            <div
              key={action.id}
              className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors group ${!isLast ? 'border-b border-white/[0.05]' : ''}`}
              onClick={() => setDetail(action)}
            >
              {/* Checkbox inline */}
              <button
                className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  isDone
                    ? 'bg-green-500/20 border-green-500/40'
                    : 'border-white/20 hover:border-[#6C8EFF]/40'
                }`}
                onClick={async e => {
                  e.stopPropagation()
                  if (isDone) return
                  const newStatus = 'concluida'
                  const res = await fetch(`/api/actions/${action.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: newStatus,
                      done_at: new Date().toISOString(),
                      _event_type: 'status_change',
                      _event_field: 'status',
                      _event_old: action.status,
                      _event_new: newStatus,
                    }),
                  })
                  if (res.ok) {
                    const updated = await res.json()
                    updateAction(updated)
                  }
                }}
              >
                {isDone && <span className="text-[9px] text-green-400">✓</span>}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${isDone ? 'line-through text-neutral-600' : 'text-neutral-300'}`}>
                  {action.text}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {action.owner && (
                    <span className="text-xs text-neutral-600">{action.owner}</span>
                  )}
                  {action.meeting_title && (
                    <span className="text-[10px] text-neutral-700 truncate">{action.meeting_title}</span>
                  )}
                  {!isDone && status === 'overdue' && action.due_date && (
                    <span className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 shrink-0">
                      Em atraso — {fmtShortDate(action.due_date)}
                    </span>
                  )}
                  {!isDone && status === 'today' && (
                    <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 shrink-0">
                      Vence hoje
                    </span>
                  )}
                  {!isDone && status === 'pending' && action.due_date && (
                    <span className="text-[11px] text-neutral-700">
                      {fmtShortDate(action.due_date)}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                ver →
              </span>
            </div>
          )
        })}

        {overflow > 0 && (
          <Link
            href={linkHref ?? '/actions'}
            className="block px-5 py-3 text-xs text-neutral-600 hover:text-neutral-400 border-t border-white/[0.05] transition-colors"
          >
            Ver mais {overflow} ações →
          </Link>
        )}
      </div>

      {detail && !editing && (
        <DetailModal
          action={detail}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(detail)}
          onDeleted={() => removeAction(detail.id)}
          onStatusChange={updateAction}
        />
      )}
      {editing && (
        <EditModal
          action={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => { updateAction(updated); setDetail(updated); setEditing(null) }}
        />
      )}
    </>
  )
}
