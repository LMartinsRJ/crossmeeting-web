'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MeetingTitleEditor({ meetingId, title }: { meetingId: number; title: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === title) { setValue(title); setEditing(false); return }
    setSaving(true)
    await fetch(`/api/meetings/${meetingId}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); save() }
            if (e.key === 'Escape') { setValue(title); setEditing(false) }
          }}
          disabled={saving}
          className="flex-1 min-w-0 bg-white/[0.05] border border-[#6C8EFF]/50 rounded-lg px-3 py-1.5 text-2xl font-semibold text-white outline-none focus:border-[#6C8EFF] disabled:opacity-60"
          style={{ lineHeight: '1.3' }}
        />
        <button
          onClick={save}
          disabled={saving}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#6C8EFF] hover:bg-[#5a7aee] text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          onClick={() => { setValue(title); setEditing(false) }}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-neutral-400 text-sm transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Clique para renomear"
      className="group flex-1 text-left min-w-0"
    >
      <h1 className="text-2xl font-semibold text-white group-hover:text-neutral-200 transition-colors inline-flex items-center gap-2">
        {value}
        <svg className="w-4 h-4 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      </h1>
    </button>
  )
}
