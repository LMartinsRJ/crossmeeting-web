'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface SpaceOption {
  id: number
  name: string
  emoji: string
  ownerName: string | null
}

export default function MoveToSpaceSelect({ meetingId, currentSpaceId }: { meetingId: number; currentSpaceId: number | null }) {
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/spaces').then(r => r.json()).then(data => {
      setSpaces([...(data.owned ?? []), ...(data.shared ?? [])])
    })
  }, [])

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    setLoading(true)
    try {
      await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId: value ? Number(value) : null }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      defaultValue={currentSpaceId ?? ''}
      onChange={handleChange}
      disabled={loading}
      className="text-xs bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] text-neutral-300 px-3 py-1.5 rounded-lg transition-colors outline-none disabled:opacity-50"
    >
      <option value="">Sem pasta</option>
      {spaces.map(s => (
        <option key={s.id} value={s.id}>
          {s.emoji} {s.name}{s.ownerName ? ` (de ${s.ownerName})` : ''}
        </option>
      ))}
    </select>
  )
}
