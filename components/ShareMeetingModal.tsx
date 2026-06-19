'use client'

import { useState, useEffect, useCallback } from 'react'

interface Share {
  id: number
  shared_with_email: string
  shared_with_id: string | null
  created_at: string
}

export default function ShareMeetingModal({ meetingId }: { meetingId: number }) {
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState<Share[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadShares = useCallback(async () => {
    const res = await fetch(`/api/meetings/${meetingId}/shares`)
    if (res.ok) setShares(await res.json())
  }, [meetingId])

  useEffect(() => {
    if (open) loadShares()
  }, [open, loadShares])

  async function handleShare(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao compartilhar.'); return }
      setEmail('')
      await loadShares()
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(shareId: number) {
    await fetch(`/api/meetings/${meetingId}/shares/${shareId}`, { method: 'DELETE' })
    setShares(s => s.filter(x => x.id !== shareId))
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] text-neutral-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <span>🔗</span> Compartilhar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <p className="text-sm font-semibold text-white mb-1">Compartilhar reunião</p>
            <p className="text-xs text-neutral-500 mb-4">A pessoa poderá ver o resumo, ações e transcrição.</p>

            <form onSubmit={handleShare} className="flex gap-2 mb-4">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#6C8EFF]/50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 rounded-xl bg-[#6C8EFF] hover:bg-[#5a7af0] disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
              >
                {loading ? '...' : 'Enviar'}
              </button>
            </form>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {shares.length === 0 ? (
                <p className="text-xs text-neutral-600">Ainda não compartilhada com ninguém.</p>
              ) : shares.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-300 truncate">{s.shared_with_email}</p>
                    <p className="text-[10px] text-neutral-600">
                      {s.shared_with_id ? 'Já tem acesso' : 'Aguardando criar conta'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(s.id)}
                    className="text-neutral-600 hover:text-red-400 transition-colors text-xs shrink-0"
                    title="Remover acesso"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setOpen(false)} className="w-full mt-4 text-xs text-neutral-700 hover:text-neutral-500 transition-colors py-1">
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
