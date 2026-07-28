import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SharedPage() {
  const supabase = await createClient()

  const { data: sharedMeetings } = await supabase
    .from('meeting_shares')
    .select('meeting_id, meetings(id, title, created_at, duration_seconds)')
    .order('created_at', { ascending: false })

  const meetings = (sharedMeetings ?? []).map((s: any) => s.meetings).filter(Boolean)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">Compartilhadas</h1>
      <p className="text-sm text-neutral-500 mb-6">Transcrições que outras pessoas compartilharam com você.</p>

      {meetings.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
          <p className="text-neutral-600 text-sm">Nenhuma transcrição compartilhada com você ainda.</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          {meetings.map((m: any, i: number) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className={`flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors ${i < meetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
            >
              <div>
                <p className="text-sm font-medium text-white">{m.title}</p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-700">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
