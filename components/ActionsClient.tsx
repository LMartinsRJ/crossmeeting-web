'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export interface ActionItem {
  id: number
  meeting_id: number | null
  meeting_title: string | null
  text: string
  owner: string | null
  due_date: string | null
  done_at: string | null
  tipo: string
  status: string
  prioridade: string
  area: string | null
  areas_relacionadas: string | null
  delegado_para: string | null
  notas: string | null
  transcript_excerpt: string | null
  created_at: string
  updated_at: string
}

interface ActionEvent {
  id: number
  user_name: string | null
  type: string
  field: string | null
  old_value: string | null
  new_value: string | null
  comment: string | null
  created_at: string
}

// ── Badges ────────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = { acao: 'AÇÃO', decisao: 'DECISÃO', estudo: 'ESTUDO', aprovacao: 'APROVAÇÃO' }
const TIPO_COLORS: Record<string, string> = {
  acao:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  decisao:   'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  estudo:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
  aprovacao: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}
const STATUS_LABELS: Record<string, string> = { pendente: 'PENDENTE', em_andamento: 'EM ANDAMENTO', concluida: 'CONCLUÍDA' }
const STATUS_COLORS: Record<string, string> = {
  pendente:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  em_andamento: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  concluida:    'bg-green-500/10 text-green-400 border-green-500/20',
}
const PRIO_LABELS: Record<string, string> = { baixa: 'BAIXA', media: 'MÉDIA', alta: 'ALTA' }
const PRIO_COLORS: Record<string, string> = {
  baixa: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  media: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  alta:  'bg-red-500/10 text-red-400 border-red-500/20',
}

function Badge({ map, colors, value }: { map: Record<string,string>, colors: Record<string,string>, value: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors[value] ?? 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}`}>
      {map[value] ?? (value ?? '').toUpperCase()}
    </span>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

export function EditModal({ action, onClose, onSaved }: { action: ActionItem, onClose: () => void, onSaved: (a: ActionItem) => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    text: action.text,
    tipo: action.tipo,
    status: action.status,
    prioridade: action.prioridade,
    owner: action.owner ?? '',
    area: action.area ?? '',
    areas_relacionadas: action.areas_relacionadas ?? '',
    due_date: action.due_date ?? '',
    delegado_para: action.delegado_para ?? '',
    notas: action.notas ?? '',
  })

  async function save() {
    setLoading(true)
    const changes: Record<string, string | null> = {}
    const events: { field: string, old: string | null, new: string | null }[] = []

    const fieldMap: [string, string | null][] = [
      ['text', action.text], ['tipo', action.tipo], ['status', action.status],
      ['prioridade', action.prioridade], ['owner', action.owner],
      ['area', action.area], ['areas_relacionadas', action.areas_relacionadas],
      ['due_date', action.due_date], ['delegado_para', action.delegado_para], ['notas', action.notas],
    ]
    for (const [k, oldVal] of fieldMap) {
      const newVal = (form as any)[k] || null
      if (newVal !== oldVal) {
        changes[k] = newVal
        events.push({ field: k, old: oldVal, new: newVal })
      }
    }

    const body: any = { ...changes }
    if (events.length === 1) {
      body._event_type = 'field_change'
      body._event_field = events[0].field
      body._event_old = events[0].old
      body._event_new = events[0].new
    } else if (events.length > 1) {
      body._event_type = 'field_change'
      body._event_field = 'multiple'
    }

    const res = await fetch(`/api/actions/${action.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const updated = await res.json()
    setLoading(false)
    if (res.ok) { onSaved(updated); onClose() }
  }

  const sel = 'w-full bg-[#0E1016] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#6C8EFF]/40'
  const inp = 'w-full bg-[#0E1016] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h3 className="text-sm font-semibold text-white">✏️ Editar Ação</h3>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-lg">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Descrição da Demanda</label>
            <textarea rows={3} value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              className={`${inp} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={sel}>
                <option value="acao">Ação</option>
                <option value="decisao">Decisão</option>
                <option value="estudo">Estudo</option>
                <option value="aprovacao">Aprovação</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={sel}>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Responsável <span className="text-neutral-700">(extraído da reunião — edite se necessário)</span></label>
            <input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Nome do responsável..." className={inp} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Área Responsável</label>
            <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Ex: TI, Financeiro..." className={inp} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Áreas Relacionadas <span className="text-neutral-700">(opcional — separe por vírgula)</span></label>
            <input value={form.areas_relacionadas} onChange={e => setForm(f => ({ ...f, areas_relacionadas: e.target.value }))} placeholder="Ex: TI, Financeiro..." className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Data de Entrega</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={`${inp} [color-scheme:dark]`} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Prioridade</label>
              <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))} className={sel}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Delegar para</label>
            <input value={form.delegado_para} onChange={e => setForm(f => ({ ...f, delegado_para: e.target.value }))} placeholder="Nome ou email do responsável..." className={inp} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Notas</label>
            <textarea rows={3} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observações, contexto adicional..." className={`${inp} resize-none`} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-300">Cancelar</button>
          <button onClick={save} disabled={loading} className="px-5 py-2 rounded-xl bg-[#6C8EFF] text-white text-sm font-medium hover:bg-[#5a7af0] disabled:opacity-60 flex items-center gap-2">
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

export function DetailModal({ action, onClose, onEdit, onDeleted, onStatusChange }: {
  action: ActionItem
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void
  onStatusChange: (a: ActionItem) => void
}) {
  const [events, setEvents] = useState<ActionEvent[] | null>(null)
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useMemo(() => {
    fetch(`/api/actions/${action.id}/events`).then(r => r.json()).then(setEvents)
  }, [action.id])

  async function addComment() {
    if (!comment.trim()) return
    setPosting(true)
    const res = await fetch(`/api/actions/${action.id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    })
    const ev = await res.json()
    setEvents(prev => [...(prev ?? []), ev])
    setComment('')
    setPosting(false)
  }

  async function changeStatus(newStatus: string) {
    const res = await fetch(`/api/actions/${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        done_at: newStatus === 'concluida' ? new Date().toISOString() : null,
        _event_type: 'status_change', _event_field: 'status',
        _event_old: action.status, _event_new: newStatus,
      }),
    })
    const updated = await res.json()
    onStatusChange(updated)
    setEvents(prev => [...(prev ?? []), {
      id: Date.now(), user_name: 'Você', type: 'status_change',
      field: 'status', old_value: action.status, new_value: newStatus,
      comment: null, created_at: new Date().toISOString(),
    }])
  }

  async function deleteAction() {
    if (!confirm('Excluir esta ação?')) return
    setDeleting(true)
    await fetch(`/api/actions/${action.id}`, { method: 'DELETE' })
    onDeleted()
    onClose()
  }

  function eventLabel(e: ActionEvent) {
    if (e.type === 'comment') return <span className="text-neutral-300">{e.comment}</span>
    if (e.type === 'status_change') return <span>alterou <b>Status</b>: {STATUS_LABELS[e.old_value ?? ''] ?? e.old_value} → <span className="text-[#6C8EFF]">{STATUS_LABELS[e.new_value ?? ''] ?? e.new_value}</span></span>
    if (e.type === 'field_change') return <span>alterou <b>{e.field}</b>{e.old_value ? `: ${e.old_value} → ${e.new_value}` : ''}</span>
    return <span>{e.type}</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            🎯 Origem da Ação
          </h3>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 text-lg">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Source meeting */}
          {action.meeting_title && (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-2.5 py-1 text-neutral-400">
                📋 {action.meeting_title}
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge map={PRIO_LABELS} colors={PRIO_COLORS} value={action.prioridade} />
            <Badge map={TIPO_LABELS} colors={TIPO_COLORS} value={action.tipo} />
            <Badge map={STATUS_LABELS} colors={STATUS_COLORS} value={action.status} />
            <span className="text-xs text-neutral-600 ml-1">📅 {fmtDate(action.created_at)}</span>
          </div>

          {/* Description */}
          <p className="text-sm text-neutral-200 leading-relaxed">{action.text}</p>
          {action.owner && <p className="text-xs text-neutral-500">Responsável: <span className="text-neutral-300">{action.owner}</span></p>}
          {action.due_date && <p className="text-xs text-neutral-500">Prazo: <span className="text-[#6C8EFF]">{fmtDate(action.due_date)}</span></p>}
          {action.notas && <p className="text-xs text-neutral-500 italic">{action.notas}</p>}

          {/* Transcript excerpt */}
          {action.transcript_excerpt && (
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">Trecho da transcrição que originou esta ação:</p>
              <blockquote className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-neutral-300 italic leading-relaxed">
                {action.transcript_excerpt}
              </blockquote>
              {action.meeting_id && (
                <Link href={`/meetings/${action.meeting_id}`} className="text-xs text-[#6C8EFF] hover:opacity-80 mt-2 inline-block">
                  Ver transcrição completa →
                </Link>
              )}
            </div>
          )}

          {/* Status quick-change */}
          <div>
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">Alterar status</p>
            <div className="flex gap-2">
              {['pendente', 'em_andamento', 'concluida'].map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${action.status === s ? STATUS_COLORS[s] + ' font-semibold' : 'border-white/[0.08] text-neutral-600 hover:text-neutral-400'}`}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Events / comments */}
          <div>
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-3">📋 Histórico & Comentários</p>
            <div className="space-y-2 mb-3">
              {events === null && <p className="text-xs text-neutral-700">Carregando...</p>}
              {events?.length === 0 && <p className="text-xs text-neutral-700">Nenhum histórico ainda.</p>}
              {events?.map(e => (
                <div key={e.id} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#6C8EFF]/20 flex items-center justify-center text-[9px] font-bold text-[#6C8EFF] shrink-0 mt-0.5">
                    {(e.user_name ?? 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-neutral-500">
                      <span className="text-neutral-400 font-medium">{e.user_name}</span>{' '}
                      {eventLabel(e)}
                    </span>
                    <span className="text-[10px] text-neutral-700 ml-2">{fmtDateTime(e.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment() }}
                placeholder="Adicionar comentário..."
                className="flex-1 bg-[#0E1016] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40"
              />
              <button onClick={addComment} disabled={posting || !comment.trim()}
                className="px-3 py-2 rounded-lg bg-[#6C8EFF] text-white text-xs font-medium hover:bg-[#5a7af0] disabled:opacity-40">
                Comentar
              </button>
            </div>
            <p className="text-[10px] text-neutral-700 mt-1">Ctrl+Enter para enviar</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between shrink-0">
          <button onClick={deleteAction} disabled={deleting} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">
            {deleting ? 'Excluindo...' : 'Excluir ação'}
          </button>
          <button onClick={onEdit}
            className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-neutral-300 hover:bg-white/[0.08] transition-colors">
            ✏️ Editar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { key: 'pendente',     label: 'Pendente',     color: 'border-orange-500/30 bg-orange-500/5' },
  { key: 'em_andamento', label: 'Em andamento', color: 'border-blue-500/30 bg-blue-500/5' },
  { key: 'concluida',   label: 'Concluída',    color: 'border-green-500/30 bg-green-500/5' },
]

export default function ActionsClient({ initial }: { initial: ActionItem[] }) {
  const [actions, setActions] = useState<ActionItem[]>(initial)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterPrio, setFilterPrio] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [detail, setDetail] = useState<ActionItem | null>(null)
  const [editing, setEditing] = useState<ActionItem | null>(null)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Realtime: atualiza ações quando outro usuário altera num space compartilhado
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('action_items_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'action_items' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setActions(prev => prev.map(a => a.id === (payload.new as ActionItem).id ? { ...a, ...(payload.new as ActionItem) } : a))
        } else if (payload.eventType === 'INSERT') {
          setActions(prev => [payload.new as ActionItem, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setActions(prev => prev.filter(a => a.id !== (payload.old as ActionItem).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = useMemo(() => {
    return actions.filter(a => {
      if (search && !a.text.toLowerCase().includes(search.toLowerCase()) && !(a.owner ?? '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterStatus && a.status !== filterStatus) return false
      if (filterTipo && a.tipo !== filterTipo) return false
      if (filterPrio && a.prioridade !== filterPrio) return false
      if (filterArea && (a.area ?? '') !== filterArea) return false
      return true
    })
  }, [actions, search, filterStatus, filterTipo, filterPrio, filterArea])

  const areas = useMemo(() => [...new Set(actions.map(a => a.area).filter(Boolean))], [actions])

  const updateAction = useCallback((updated: ActionItem) => {
    setActions(prev => prev.map(a => a.id === updated.id ? updated : a))
    if (detail?.id === updated.id) setDetail(updated)
  }, [detail])

  const removeAction = useCallback((id: number) => {
    setActions(prev => prev.filter(a => a.id !== id))
  }, [])

  async function moveToStatus(actionId: number, newStatus: string) {
    const action = actions.find(a => a.id === actionId)
    if (!action || action.status === newStatus) return
    const body: Record<string, unknown> = { status: newStatus, _event_type: 'status_change', _event_field: 'status', _event_old: action.status, _event_new: newStatus }
    if (newStatus === 'concluida') body.done_at = new Date().toISOString()
    else body.done_at = null
    await fetch(`/api/actions/${actionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    updateAction({ ...action, status: newStatus, done_at: newStatus === 'concluida' ? new Date().toISOString() : null })
  }

  const sel = 'bg-[#0E1016] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-neutral-400 outline-none focus:border-[#6C8EFF]/40'

  const pending = actions.filter(a => a.status === 'pendente').length
  const done = actions.filter(a => a.status === 'concluida').length

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <h1 className="text-2xl font-semibold text-white">Ações</h1>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">{pending} pendentes</span>
            <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">{done} concluídas</span>
          </div>
        </div>
        {/* Toggle tabela / kanban */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
          <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-md text-xs transition-colors ${view === 'table' ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
            Tabela
          </button>
          <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-xs transition-colors ${view === 'kanban' ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
            Kanban
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar na descrição..."
          className="bg-[#0E1016] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[#6C8EFF]/40 w-52"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={sel}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={sel}>
          <option value="">Todos os tipos</option>
          <option value="acao">Ação</option>
          <option value="decisao">Decisão</option>
          <option value="estudo">Estudo</option>
          <option value="aprovacao">Aprovação</option>
        </select>
        <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)} className={sel}>
          <option value="">Todas as prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        {areas.length > 0 && (
          <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className={sel}>
            <option value="">Todas as áreas</option>
            {areas.map(a => <option key={a} value={a!}>{a}</option>)}
          </select>
        )}
        {(search || filterStatus || filterTipo || filterPrio || filterArea) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterTipo(''); setFilterPrio(''); setFilterArea('') }}
            className="text-xs text-neutral-600 hover:text-neutral-400 px-2">✕ Limpar</button>
        )}
        <span className="text-xs text-neutral-700 self-center ml-auto">{filtered.length} {filtered.length === 1 ? 'ação' : 'ações'}</span>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {KANBAN_COLUMNS.map(col => {
            const colItems = filtered.filter(a => a.status === col.key)
            return (
              <div
                key={col.key}
                className={`rounded-2xl border p-3 min-h-[200px] transition-colors ${col.color} ${dragOverCol === col.key ? 'ring-2 ring-[#6C8EFF]/40' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOverCol(null)
                  const id = Number(e.dataTransfer.getData('actionId'))
                  if (id) moveToStatus(id, col.key)
                }}
              >
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-1">
                  {col.label} <span className="text-neutral-700 font-normal">({colItems.length})</span>
                </p>
                <div className="space-y-2">
                  {colItems.map(a => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('actionId', String(a.id))}
                      onClick={() => setDetail(a)}
                      className="bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-xl p-3 cursor-grab active:cursor-grabbing transition-colors"
                    >
                      {a.meeting_title && (
                        <p className="text-[10px] text-[#6C8EFF]/60 truncate mb-1">📋 {a.meeting_title}</p>
                      )}
                      <p className={`text-xs leading-snug ${a.status === 'concluida' ? 'line-through text-neutral-600' : 'text-neutral-200'}`}>{a.text}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge map={PRIO_LABELS} colors={PRIO_COLORS} value={a.prioridade} />
                        {a.owner && <span className="text-[10px] text-neutral-600 truncate max-w-[100px]">{a.owner}</span>}
                        {a.due_date && a.status !== 'concluida' && (() => {
                          const today = new Date().toISOString().slice(0, 10)
                          if (a.due_date < today) return <span className="text-[10px] text-red-400">Em atraso</span>
                          if (a.due_date === today) return <span className="text-[10px] text-amber-400">Vence hoje</span>
                          return null
                        })()}
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <p className="text-xs text-neutral-700 px-1 py-4 text-center">Solte aqui</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className={`bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden ${view === 'kanban' ? 'hidden' : ''}`}>
        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_100px_90px_90px_90px_110px] gap-2 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
          {['DESCRIÇÃO','RESPONSÁVEL','TIPO','PRIORIDADE','STATUS','CRIADO EM','PRAZO'].map(h => (
            <span key={h} className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-neutral-600 p-6">Nenhuma ação encontrada.</p>
        )}

        {filtered.map((a, i) => (
          <div
            key={a.id}
            onClick={() => setDetail(a)}
            className={`grid grid-cols-[1fr_140px_100px_90px_90px_90px_110px] gap-2 px-5 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors group ${i < filtered.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
          >
            <div className="min-w-0">
              {a.meeting_title && (
                <p className="text-[10px] text-[#6C8EFF]/70 truncate mb-0.5">📋 {a.meeting_title}</p>
              )}
              <p className={`text-sm leading-snug ${a.status === 'concluida' ? 'line-through text-neutral-600' : 'text-neutral-200'}`}>
                {a.text}
              </p>
            </div>
            <p className="text-xs text-neutral-500 self-center truncate">{a.owner ?? '—'}</p>
            <div className="self-center"><Badge map={TIPO_LABELS} colors={TIPO_COLORS} value={a.tipo} /></div>
            <div className="self-center"><Badge map={PRIO_LABELS} colors={PRIO_COLORS} value={a.prioridade} /></div>
            <div className="self-center"><Badge map={STATUS_LABELS} colors={STATUS_COLORS} value={a.status} /></div>
            <p className="text-xs text-neutral-600 self-center">{fmtDate(a.created_at)}</p>
            <div className="flex items-center justify-between self-center">
              {(() => {
                if (!a.due_date || a.status === 'concluida') return <p className="text-xs text-neutral-600">{a.due_date ? fmtDate(a.due_date) : '—'}</p>
                const todayStr = new Date().toISOString().slice(0, 10)
                if (a.due_date < todayStr) return <span className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 shrink-0">Em atraso — {fmtDate(a.due_date)}</span>
                if (a.due_date === todayStr) return <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 shrink-0">Vence hoje</span>
                return <p className="text-xs text-neutral-600">{fmtDate(a.due_date)}</p>
              })()}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditing(a) }}
                  className="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] flex items-center justify-center text-xs text-neutral-400" title="Editar">✏️</button>
                <button onClick={async () => {
                    await fetch(`/api/actions/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'concluida', done_at: new Date().toISOString(), _event_type: 'status_change', _event_field: 'status', _event_old: a.status, _event_new: 'concluida' }) })
                    updateAction({ ...a, status: 'concluida', done_at: new Date().toISOString() })
                  }}
                  className="w-6 h-6 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center text-xs" title="Concluir">✓</button>
                <button onClick={async () => {
                    if (!confirm('Excluir?')) return
                    await fetch(`/api/actions/${a.id}`, { method: 'DELETE' })
                    removeAction(a.id)
                  }}
                  className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-xs text-red-400" title="Excluir">🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {detail && !editing && (
        <DetailModal
          action={detail}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(detail)}
          onDeleted={() => removeAction(detail.id)}
          onStatusChange={updated => updateAction(updated)}
        />
      )}
      {editing && (
        <EditModal
          action={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => { updateAction(updated); setDetail(updated) }}
        />
      )}
    </div>
  )
}
