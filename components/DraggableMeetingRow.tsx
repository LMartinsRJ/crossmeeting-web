'use client'

import Link from 'next/link'

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
  return (
    <Link
      href={href}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/crossmeeting-meeting-id', String(meetingId))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`${className ?? ''} cursor-grab active:cursor-grabbing`}
    >
      {children}
    </Link>
  )
}
