'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDragStore } from './DragStore'

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
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { draggingIds } = useDragStore()
  const isDragging = draggingIds.length > 0

  useEffect(() => {
    fetch('/api/spaces').then(r => r.json()).then(data => {
      setSpaces([...(data.owned ?? []), ...(data.shared ?? [])])
    })
  }, [])

  const handleDrop = useCallback(async (spaceId: number, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverId(null)
    setError(null)
    const raw = e.dataTransfer.getData('text/crossmeeting-meeting-id')
    if (!raw) return
    const meetingIds = raw.split(',').map(Number).filter(Boolean)
    if (meetingIds.length === 0) return
    const results = await Promise.all(meetingIds.map(id =>
      fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId }),
      }).then(r => r.ok)
    ))
    const failed = results.filter(ok => !ok).length
    if (failed > 0) {
      setError(`${failed} de ${meetingIds.length} reunião(ões) não puderam ser movidas (sem permissão).`)
      setTimeout(() => setError(null), 4000)
    }
    setMovedId(spaceId)
    setTimeout(() => setMovedId(prev => (prev === spaceId ? null : prev)), 1500)
    router.refresh()
  }, [router])

  if (spaces.length === 0) return null

  return (
    <div className={`mb-5 transition-all duration-200 ${isDragging ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
      <p className="text-xs text-neutral-600 mb-2">
        {isDragging
          ? <span className="text-[#6C8EFF]">Solte em um space para mover</span>
          : 'Arraste uma reunião até um space para organizar:'}
      </p>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {spaces.map(s => {
          const isOver = dragOverId === s.id
          const isMoved = movedId === s.id
          return (
            <div
              key={s.id}
              onDragOver={e => { e.preventDefault(); setDragOverId(s.id) }}
              onDragLeave={() => setDragOverId(prev => (prev === s.id ? null : prev))}
              onDrop={e => handleDrop(s.id, e)}
              className={`
                flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all duration-150 select-none
                ${isMoved
                  ? 'bg-green-500/15 border-green-500/40 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : isOver
                    ? 'bg-[#6C8EFF]/25 border-[#6C8EFF]/60 text-[#6C8EFF] scale-110 shadow-[0_0_16px_rgba(108,142,255,0.35)]'
                    : isDragging
                      ? 'bg-white/[0.06] border-[#6C8EFF]/25 text-neutral-300 shadow-[0_0_8px_rgba(108,142,255,0.1)]'
                      : 'bg-white/[0.04] border-white/[0.08] text-neutral-400'
                }
              `}
            >
              <span className={`transition-transform duration-150 ${isOver ? 'scale-125' : ''}`}>
                {isMoved ? '✓' : s.emoji}
              </span>
              <span>{s.name}</span>
              {isOver && !isMoved && <span className="text-[#6C8EFF]/70">← soltar aqui</span>}
              {s.ownerName && !isOver && <span className="text-neutral-700">· de {s.ownerName}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
