'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  googleLinked: boolean // google_calendar_token não nulo nas profiles
  lastSynced: string | null
  syncedCount: number
}

export default function GoogleMeetCard({ googleLinked, lastSynced, syncedCount }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const supabase = createClient()

  async function connectGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly',
        redirectTo: `${window.location.origin}/auth/callback?next=/settings?tab=api`,
      },
    })
    if (error) setMsg({ text: error.message, ok: false })
  }

  async function sync() {
    setSyncing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/integrations/google-meet/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setMsg({ text: json.error, ok: false }); return }
      setMsg({ text: `${json.imported} reunião(ões) importada(s) de ${json.total} encontradas no Drive.`, ok: true })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xl shrink-0 mt-0.5">🟩</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">Google Meet</p>
            {googleLinked ? (
              <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">Conta vinculada</span>
            ) : (
              <span className="text-[10px] bg-white/[0.04] text-neutral-500 border border-white/[0.08] px-2 py-0.5 rounded-full shrink-0">Não conectado</span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
            Importa transcrições salvas automaticamente no Google Drive após reuniões do Meet.
            {!googleLinked && ' Requer Google Workspace com transcrição automática habilitada.'}
          </p>
          {googleLinked && lastSynced && (
            <p className="text-[11px] text-neutral-600 mt-1">
              Última sync: {new Date(lastSynced).toLocaleString('pt-BR')} · {syncedCount} importadas
            </p>
          )}
          {googleLinked && (
            <p className="text-[11px] text-amber-500/70 mt-1.5 leading-relaxed">
              Transcrições automáticas requerem Google Workspace Business Standard ou superior com a função habilitada pelo administrador.
            </p>
          )}
        </div>
      </div>

      {msg && (
        <p className={`text-xs mb-3 leading-relaxed ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      {!googleLinked ? (
        <button
          onClick={connectGoogle}
          className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 transition-colors"
        >
          Conectar com Google
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={sync}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar Meet'}
          </button>
          <button
            onClick={connectGoogle}
            className="px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] text-neutral-500 text-xs font-medium border border-white/[0.06] transition-colors"
          >
            Re-autorizar Drive
          </button>
        </div>
      )}
    </div>
  )
}
