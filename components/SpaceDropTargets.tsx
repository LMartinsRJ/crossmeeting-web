'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SpaceOption {
  id: number
  name: string
  emoji: string
  ownerName: string | null
}

export default function SpaceDropTargets() {
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [movedId, setMovedId] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/spaces').then(r => r.json()).then(data => {
      setSpaces([...(data.owned ?? []), ...(data.shared ?? [])])
    })
  }, [])

  const handleDrop = useCallback(async (spaceId: number, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverId(null)
    const meetingId = e.dataTransfer.getData('text/crossmeeting-meeting-id')
    if (!meetingId) return
    await fetch(`/api/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaceId }),
    })
    setMovedId(spaceId)
    setTimeout(() => setMovedId(null), 1500)
    router.refresh()
  }, [router])

  if (spaces.length === 0) return null

  return (
    <div className="mb-5">
      <p className="text-xs text-neutral-600 mb-2">Arraste uma reunião até uma pasta para organizar:</p>
      <div className="flex flex-wrap gap-2">
        {spaces.map(s => (
          <div
            key={s.id}
            onDragOver={e => { e.preventDefault(); setDragOverId(s.id) }}
            onDragLeave={() => setDragOverId(prev => (prev === s.id ? null : prev))}
            onDrop={e => handleDrop(s.id, e)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              movedId === s.id
                ? 'bg-green-500/15 border-green-500/30 text-green-400'
                : dragOverId === s.id
                  ? 'bg-[#6C8EFF]/20 border-[#6C8EFF]/50 text-[#6C8EFF] scale-105'
                  : 'bg-white/[0.04] border-white/[0.08] text-neutral-400'
            }`}
          >
            <span>{movedId === s.id ? '✓' : s.emoji}</span>
            <span>{s.name}</span>
            {s.ownerName && <span className="text-neutral-700">· de {s.ownerName}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
