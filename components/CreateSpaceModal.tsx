'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EMOJIS = ['📁', '🚀', '💼', '📊', '🎯', '🧩', '🛠️', '📌']

export default function CreateSpaceModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📁')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao criar space.'); return }
      setOpen(false)
      setName('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6C8EFF]/10 border border-[#6C8EFF]/20 text-[#6C8EFF] text-sm font-medium hover:bg-[#6C8EFF]/20 transition-colors"
      >
        + Novo space
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <p className="text-sm font-semibold text-white mb-4">Novo space</p>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-wrap gap-2 mb-4">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors ${
                      emoji === e ? 'bg-[#6C8EFF]/20 border border-[#6C8EFF]/40' : 'bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07]'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Cliente Acme"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#6C8EFF]/50 transition-colors mb-4"
              />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => !loading && setOpen(false)} className="px-4 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-[#6C8EFF] hover:bg-[#5a7af0] disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {loading ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
