'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

interface DropdownPos { top: number; right: number }

export default function MeetingMenuButton({ meetingId, title }: { meetingId: number; title: string }) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newTitle, setNewTitle] = useState(title)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [loadingRename, setLoadingRename] = useState(false)
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }, [])

  useEffect(() => {
    if (!open) return
    calcPos()
    function onScroll() { setOpen(false) }
    function onMouse(e: MouseEvent) {
      if (renaming) return // não fecha enquanto o usuário está digitando
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) { setOpen(false); setRenaming(false) }
    }
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousedown', onMouse)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [open, calcPos])

  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.focus(), 50)
  }, [renaming])

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Mover para a lixeira? A reunião ficará lá por 15 dias antes de ser apagada definitivamente.')) return
    setLoadingDelete(true); setOpen(false)
    await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault(); e.stopPropagation()
    const trimmed = newTitle.trim()
    if (!trimmed || trimmed === title) { setRenaming(false); setOpen(false); return }
    setLoadingRename(true)
    await fetch(`/api/meetings/${meetingId}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    setLoadingRename(false); setRenaming(false); setOpen(false)
    router.refresh()
  }

  const loading = loadingDelete || loadingRename

  const dropdown = open && pos ? createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos.top,
        right: pos.right,
        zIndex: 9999,
        backgroundColor: '#0f1117',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.85)',
        width: 200,
        fontSize: 14,
        overflow: 'hidden',
        padding: '4px 0',
      }}
      onClick={e => e.stopPropagation()}
    >
      {renaming ? (
        <form onSubmit={handleRename} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 13,
              color: '#fff',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
            onKeyDown={e => { if (e.key === 'Escape') { setRenaming(false); setNewTitle(title) } }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={loadingRename} style={{ flex: 1, padding: '5px 0', borderRadius: 8, background: '#6C8EFF', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', opacity: loadingRename ? 0.5 : 1 }}>
              Salvar
            </button>
            <button type="button" onClick={() => { setRenaming(false); setNewTitle(title) }} style={{ flex: 1, padding: '5px 0', borderRadius: 8, background: 'rgba(255,255,255,0.07)', color: '#ccc', fontSize: 12, cursor: 'pointer', border: 'none' }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <button onClick={() => router.push(`/meetings/${meetingId}`)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', color: '#d4d4d4', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Abrir reunião
          </button>
          <button onClick={() => setRenaming(true)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', color: '#d4d4d4', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Renomear
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
          <button onClick={handleDelete} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 16px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Mover para lixeira
          </button>
        </>
      )}
    </div>,
    document.body
  ) : null

  return (
    <div onClick={e => e.preventDefault()}>
      <button
        ref={btnRef}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); setRenaming(false) }}
        disabled={loading}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/>
          </svg>
        )}
      </button>
      {dropdown}
    </div>
  )
}
