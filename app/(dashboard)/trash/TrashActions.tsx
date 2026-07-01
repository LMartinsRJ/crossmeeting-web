'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function TrashActions({ meetingId }: { meetingId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function restore() {
    setLoading(true)
    await fetch(`/api/meetings/${meetingId}/restore`, { method: 'POST' })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={restore}
      disabled={loading}
      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.07] transition-colors disabled:opacity-40"
    >
      {loading ? '…' : 'Restaurar'}
    </button>
  )
}
