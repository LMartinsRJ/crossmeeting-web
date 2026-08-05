'use client'

import { useEffect, useState } from 'react'

interface Props {
  firstName: string
  todayMeetings: any[]
  todayActions: any[]
  overdueActions: any[]
  todayEvents: any[]
  dateLabel: string
}

export default function BriefingText(props: Props) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(props),
    })
      .then(r => r.json())
      .then(d => setText(d.text ?? ''))
      .catch(() => setText(''))
  }, [])

  if (text === null) {
    return (
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Briefing do dia</h2>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-3">
          <div className="h-3 bg-white/[0.06] rounded animate-pulse w-full" />
          <div className="h-3 bg-white/[0.06] rounded animate-pulse w-5/6" />
          <div className="h-3 bg-white/[0.06] rounded animate-pulse w-4/6" />
        </div>
      </div>
    )
  }

  if (!text) return null

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Briefing do dia</h2>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <div className="text-sm text-neutral-300 leading-relaxed space-y-3">
          {text.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
