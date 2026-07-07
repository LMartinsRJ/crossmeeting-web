'use client'

import { useState } from 'react'

type Props = {
  connected: boolean
  lastSynced: string | null
  syncedCount: number
}

export default function FirefliesCard({ connected: initialConnected, lastSynced, syncedCount }: Props) {
  const [connected, setConnected] = useState(initialConnected)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function save() {
    if (!apiKey.trim()) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/fireflies/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg({ text: json.error, ok: false }); return }
      setConnected(true)
      setApiKey('')
      setMsg({ text: 'Conectado com sucesso.', ok: true })
    } finally {
      setSaving(false)
    }
  }

  async function sync() {
    setSyncing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/fireflies/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setMsg({ text: json.error, ok: false }); return }
      setMsg({ text: `${json.imported} reunião(ões) importada(s) de ${json.total} encontrada(s).`, ok: true })
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    setMsg(null)
    await fetch('/api/integrations/fireflies/connect', { method: 'DELETE' })
    setConnected(false)
    setMsg({ text: 'Desconectado.', ok: true })
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xl shrink-0 mt-0.5">🔥</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">Fireflies.ai</p>
            {connected ? (
              <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">Conectado</span>
            ) : (
              <span className="text-[10px] bg-white/[0.04] text-neutral-500 border border-white/[0.08] px-2 py-0.5 rounded-full shrink-0">Não conectado</span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
            Cole sua API key do Fireflies para sincronizar transcrições e resumos.
          </p>
          {connected && lastSynced && (
            <p className="text-[11px] text-neutral-600 mt-1">
              Última sync: {new Date(lastSynced).toLocaleString('pt-BR')} · {syncedCount} importadas
            </p>
          )}
        </div>
      </div>

      {msg && (
        <p className={`text-xs mb-3 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      {!connected ? (
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/50 transition-colors"
          />
          <button
            onClick={save}
            disabled={saving || !apiKey.trim()}
            className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Validando…' : 'Salvar'}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={sync}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
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
