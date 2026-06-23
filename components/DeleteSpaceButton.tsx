'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteSpaceButton({ spaceId, spaceName }: { spaceId: number; spaceName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao excluir.'); return }
      router.push('/spaces')
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-xs bg-white/[0.04] border border-white/[0.08] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-neutral-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        <span>🗑️</span> Excluir
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setConfirming(false)} />
          <div className="relative w-full max-w-sm bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <p className="text-sm font-semibold text-white mb-1">Excluir "{spaceName}"?</p>
            <p className="text-xs text-neutral-500 mb-4">
              As reuniões deste space não serão apagadas — voltam para o space padrão (Minhas Notas).
            </p>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirming(false)} disabled={deleting} className="px-4 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
