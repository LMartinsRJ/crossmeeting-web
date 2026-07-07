'use client'

import { useState } from 'react'

const EVENT_LABELS: Record<string, string> = {
  action_done: 'Ação concluída',
  briefing_ready: 'Briefing enviado',
}

type Webhook = {
  id: number
  name: string
  url: string
  events: string[]
  status: string
  last_triggered_at: string | null
  error_count: number
  last_error: string | null
}

export default function WebhookManager({ initialWebhooks }: { initialWebhooks: Webhook[] }) {
  const [webhooks, setWebhooks] = useState(initialWebhooks)
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; status?: number; error?: string }>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  function toggleEvent(ev: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  async function save() {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) {
      setMsg('Preencha nome, URL e selecione ao menos um evento.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error); return }
      setWebhooks(prev => [json, ...prev])
      setForm({ name: '', url: '', secret: '', events: [] })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
    setWebhooks(prev => prev.filter(w => w.id !== id))
  }

  async function test(id: number) {
    setTesting(id)
    setTestResult(prev => ({ ...prev, [id]: undefined as any }))
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'POST' })
      const json = await res.json()
      setTestResult(prev => ({ ...prev, [id]: json }))
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Lista */}
      {webhooks.length === 0 && !showForm ? (
        <p className="text-xs text-neutral-600 px-1">Nenhum webhook configurado.</p>
      ) : (
        <div className="space-y-2">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white truncate">{wh.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      wh.status === 'active'
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                        : wh.status === 'error'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-white/[0.04] text-neutral-500 border border-white/[0.08]'
                    }`}>
                      {wh.status === 'active' ? 'Ativo' : wh.status === 'error' ? 'Erro' : 'Pausado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 font-mono truncate">{wh.url}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {wh.events.map(ev => (
                      <span key={ev} className="text-[10px] bg-[#6C8EFF]/10 text-[#6C8EFF] border border-[#6C8EFF]/20 px-2 py-0.5 rounded-full">
                        {EVENT_LABELS[ev] ?? ev}
                      </span>
                    ))}
                  </div>
                  {wh.last_triggered_at && (
                    <p className="text-[11px] text-neutral-700 mt-1">
                      Último disparo: {new Date(wh.last_triggered_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                  {wh.last_error && (
                    <p className="text-[11px] text-red-500/70 mt-0.5">Erro: {wh.last_error}</p>
                  )}
                  {testResult[wh.id] !== undefined && (
                    <p className={`text-[11px] mt-0.5 ${testResult[wh.id]?.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult[wh.id]?.ok
                        ? `Teste OK (HTTP ${testResult[wh.id].status})`
                        : `Falhou: ${testResult[wh.id]?.error ?? `HTTP ${testResult[wh.id]?.status}`}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => test(wh.id)}
                    disabled={testing === wh.id}
                    className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-40"
                  >
                    {testing === wh.id ? 'Testando…' : 'Testar'}
                  </button>
                  <button
                    onClick={() => remove(wh.id)}
                    className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário */}
      {showForm ? (
        <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 space-y-3">
          {msg && <p className="text-xs text-red-400">{msg}</p>}
          <input
            type="text"
            placeholder="Nome (ex: Notificação Slack)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/50 transition-colors"
          />
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/50 transition-colors"
          />
          <input
            type="password"
            placeholder="Secret para HMAC (opcional)"
            value={form.secret}
            onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/50 transition-colors"
          />
          <div>
            <p className="text-[11px] text-neutral-600 mb-2">Eventos</p>
            <div className="flex gap-2">
              {Object.entries(EVENT_LABELS).map(([ev, label]) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    form.events.includes(ev)
                      ? 'bg-[#6C8EFF]/20 text-[#6C8EFF] border-[#6C8EFF]/30'
                      : 'bg-white/[0.03] text-neutral-500 border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar webhook'}
            </button>
            <button
              onClick={() => { setShowForm(false); setMsg(null) }}
              className="px-4 py-2 rounded-xl bg-white/[0.03] text-neutral-500 text-xs border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-neutral-400 text-xs border border-white/[0.06] transition-colors"
        >
          + Adicionar webhook
        </button>
      )}
    </div>
  )
}
