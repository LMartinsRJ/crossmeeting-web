'use client'

import { useState } from 'react'

type Cred = { status: string; last_synced_at: string | null; synced_count: number } | null

export default function ZoomCard({ cred }: { cred: Cred }) {
  const connected = cred?.status === 'active'
  const [accountId, setAccountId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function save() {
    if (!accountId.trim() || !clientId.trim() || !clientSecret.trim()) {
      setMsg({ text: 'Preencha Account ID, Client ID e Client Secret.', ok: false })
      return
    }
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/zoom/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId.trim(), client_id: clientId.trim(), client_secret: clientSecret.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg({ text: json.error, ok: false }); return }
      setMsg({ text: 'Zoom conectado com sucesso!', ok: true })
      setAccountId(''); setClientId(''); setClientSecret('')
      setTimeout(() => window.location.reload(), 800)
    } finally {
      setSaving(false)
    }
  }

  async function sync() {
    setSyncing(true); setMsg(null)
    try {
      const res = await fetch('/api/integrations/zoom/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setMsg({ text: json.error, ok: false }); return }
      setMsg({ text: `${json.imported} reunião(ões) importada(s) de ${json.total} gravações encontradas.`, ok: true })
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    await fetch('/api/integrations/zoom/connect', { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xl shrink-0 mt-0.5">💙</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">Zoom</p>
            {connected ? (
              <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">Conectado</span>
            ) : (
              <span className="text-[10px] bg-white/[0.04] text-neutral-500 border border-white/[0.08] px-2 py-0.5 rounded-full shrink-0">Não conectado</span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
            Importe gravações e transcrições das suas reuniões Zoom via Server-to-Server OAuth.
          </p>
          {connected && cred?.last_synced_at && (
            <p className="text-[11px] text-neutral-600 mt-1">
              Última sync: {new Date(cred.last_synced_at).toLocaleString('pt-BR')} · {cred.synced_count} importadas
            </p>
          )}
        </div>
      </div>

      {msg && (
        <p className={`text-xs mb-3 leading-relaxed ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      {!connected ? (
        <div className="space-y-2">
          <p className="text-[11px] text-neutral-600 leading-relaxed">
            Crie um app <strong className="text-neutral-400">Server-to-Server OAuth</strong> no{' '}
            <span className="text-[#6C8EFF]">Zoom Marketplace</span> e cole as credenciais abaixo.
          </p>
          <input
            type="text"
            placeholder="Account ID"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40"
          />
          <input
            type="text"
            placeholder="Client ID"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40"
          />
          <input
            type="password"
            placeholder="Client Secret"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Verificando…' : 'Conectar Zoom'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={sync}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 transition-colors"
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar Zoom'}
          </button>
          <button
            onClick={disconnect}
            className="px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-neutral-500 text-xs font-medium border border-white/[0.06] transition-colors"
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  )
}
