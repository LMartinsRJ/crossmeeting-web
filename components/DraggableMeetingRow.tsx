'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useMeetingSelection } from './MeetingSelectionContext'
import { useDragStore } from './DragStore'

export default function DraggableMeetingRow({
  meetingId,
  href,
  className,
  children,
  title,
}: {
  meetingId: number
  href: string
  className?: string
  children: React.ReactNode
  title?: string
}) {
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const selection = useMeetingSelection()
  const isSelected = selection?.selected.has(meetingId) ?? false
  const { setDragging, clearDragging } = useDragStore()

  function buildGhost(count: number, label: string) {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:-999px;left:-999px;background:#1a1d27;border:1px solid rgba(108,142,255,0.4);border-radius:10px;padding:8px 14px;color:#e5e7eb;font-size:13px;font-family:inherit;white-space:nowrap;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);'
    el.innerHTML = count > 1
      ? `<span style="background:#6C8EFF;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600">${count}</span>${label}`
      : `📋 ${label}`
    document.body.appendChild(el)
    ghostRef.current = el
    return el
  }

  return (
    <Link
      href={href}
      draggable
      onDragStart={e => {
        const ids = selection && isSelected && selection.selected.size > 1
          ? [...selection.selected]
          : [meetingId]
        e.dataTransfer.setData('text/crossmeeting-meeting-id', ids.join(','))
        e.dataTransfer.effectAllowed = 'move'

        const label = ids.length > 1 ? 'reuniões' : (title ?? 'reunião')
        const ghost = buildGhost(ids.length, label)
        e.dataTransfer.setDragImage(ghost, 20, 20)

        setDragging(ids)
        // cleanup ghost after browser captures it
        setTimeout(() => { ghost.remove(); ghostRef.current = null }, 0)
      }}
      onDragEnd={() => {
        ghostRef.current?.remove()
        ghostRef.current = null
        clearDragging()
      }}
      className={`${className ?? ''} cursor-grab active:cursor-grabbing transition-opacity flex items-center gap-3`}
    >
      {selection && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => selection.toggle(meetingId)}
          onClick={e => { e.preventDefault(); e.stopPropagation(); selection.toggle(meetingId) }}
          className="shrink-0 w-3.5 h-3.5 rounded accent-[#6C8EFF] cursor-pointer"
        />
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </Link>
  )
}
