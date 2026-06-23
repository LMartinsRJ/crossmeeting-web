'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SpaceCard({
  id, href, emoji, name, isDefault, meetingCount, ownerName, canDelete,
}: {
  id: number
  href: string
  emoji: string
  name: string
  isDefault?: boolean
  meetingCount: number
  ownerName?: string | null
  canDelete: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen])

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/spaces/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao excluir.'); return }
      setConfirming(false)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`relative group ${ownerName ? 'border border-purple-500/15 hover:border-purple-500/30' : 'border border-white/[0.06] hover:border-white/[0.12]'} bg-white/[0.03] rounded-2xl transition-colors`}>
      <Link href={href} className="block p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xl">{emoji}</span>
          {isDefault && (
            <span className="text-[9px] text-neutral-600 bg-white/[0.04] px-1.5 py-0.5 rounded-full shrink-0">padrão</span>
          )}
        </div>
        <p className="text-sm font-medium text-white mt-2 truncate pr-5">{name}</p>
        <p className="text-xs text-neutral-600 mt-0.5">
          {meetingCount} reuniões{ownerName ? ` · de ${ownerName}` : ''}
        </p>
      </Link>

      {canDelete && (
        <div className="absolute top-2.5 right-2.5" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="text-neutral-600 hover:text-neutral-300 transition-colors px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 bg-[#13161D] border border-white/[0.1] rounded-xl shadow-2xl py-1 min-w-32 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); setConfirming(true) }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors"
              >
                🗑️ Excluir
              </button>
            </div>
          )}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setConfirming(false)} />
          <div className="relative w-full max-w-sm bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <p className="text-sm font-semibold text-white mb-1">Excluir "{name}"?</p>
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
    </div>
  )
}
