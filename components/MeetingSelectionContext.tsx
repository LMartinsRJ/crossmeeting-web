'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface MeetingSelectionValue {
  selected: Set<number>
  toggle: (id: number) => void
  clear: () => void
}

const MeetingSelectionContext = createContext<MeetingSelectionValue | null>(null)

export function useMeetingSelection() {
  return useContext(MeetingSelectionContext)
}

interface SpaceOption {
  id: number
  name: string
  emoji: string
}

export default function MeetingSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const toggle = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  useEffect(() => {
    if (selected.size > 0 && spaces.length === 0) {
      fetch('/api/spaces').then(r => r.json()).then(data => {
        setSpaces([...(data.owned ?? []), ...(data.shared ?? [])])
      })
    }
  }, [selected.size, spaces.length])

  async function handleMoveTo(spaceId: number) {
    setMoving(true)
    setError(null)
    try {
      const ids = [...selected]
      const results = await Promise.all(ids.map(id =>
        fetch(`/api/meetings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spaceId }),
        }).then(r => r.ok)
      ))
      const failed = results.filter(ok => !ok).length
      if (failed > 0) {
        setError(`${failed} de ${ids.length} reunião(ões) não puderam ser movidas (sem permissão).`)
        setTimeout(() => setError(null), 4000)
      }
      clear()
      router.refresh()
    } finally {
      setMoving(false)
    }
  }

  return (
    <MeetingSelectionContext.Provider value={{ selected, toggle, clear }}>
      {children}

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 items-center">
          {error && <p className="text-xs text-red-400 bg-[#13161D] border border-red-500/20 rounded-xl px-3 py-1.5">{error}</p>}
          <div className="flex items-center gap-3 bg-[#13161D] border border-white/[0.1] rounded-2xl shadow-2xl px-4 py-2.5">
          <span className="text-sm text-neutral-300">{selected.size} selecionada{selected.size > 1 ? 's' : ''}</span>
          <select
            disabled={moving}
            defaultValue=""
            onChange={e => { if (e.target.value) handleMoveTo(Number(e.target.value)) }}
            className="text-xs bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] text-neutral-300 px-3 py-1.5 rounded-lg transition-colors outline-none disabled:opacity-50"
          >
            <option value="" disabled>Mover para...</option>
            {spaces.map(s => (
              <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
            ))}
          </select>
          <button
            onClick={clear}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Cancelar
          </button>
          </div>
        </div>
      )}
    </MeetingSelectionContext.Provider>
  )
}
