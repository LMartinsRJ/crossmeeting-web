'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMeetingSelection } from './MeetingSelectionContext'

export default function DraggableMeetingRow({
  meetingId,
  href,
  className,
  children,
}: {
  meetingId: number
  href: string
  className?: string
  children: React.ReactNode
}) {
  const [isDragging, setIsDragging] = useState(false)
  const selection = useMeetingSelection()
  const isSelected = selection?.selected.has(meetingId) ?? false

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
        setIsDragging(true)
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`${className ?? ''} cursor-grab active:cursor-grabbing transition-opacity flex items-center gap-3 ${isDragging ? 'opacity-40' : ''}`}
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
