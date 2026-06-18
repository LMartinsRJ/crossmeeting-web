import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ImportTranscriptModal from '@/components/ImportTranscriptModal'

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('meetings')
    .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'portuguese' })
  }

  const { data: meetings } = await query

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Reuniões</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{meetings?.length ?? 0} encontradas</span>
          <ImportTranscriptModal />
        </div>
      </div>

      {/* Busca */}
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar em títulos e transcrições..."
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#6C8EFF]/50 transition-colors"
        />
      </form>

      {/* Lista */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {!meetings || meetings.length === 0 ? (
          <p className="text-sm text-neutral-600 p-6">
            {q ? `Nenhuma reunião encontrada para "${q}".` : 'Nenhuma reunião encontrada.'}
          </p>
        ) : meetings.map((m, i) => {
          let summary: string | null = null
          let attendees: { name: string; email: string }[] = []
          try { summary = m.enhancement ? JSON.parse(m.enhancement)?.summary : null } catch {}
          try { attendees = m.attendees ? (Array.isArray(m.attendees) ? m.attendees : JSON.parse(m.attendees)) : [] } catch {}

          return (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className={`block px-6 py-4 hover:bg-white/[0.03] transition-colors ${i < meetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.title}</p>
                  {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                  {attendees.length > 0 && (
                    <p className="text-xs text-neutral-600 mt-1">
                      {attendees.slice(0, 3).map(a => a.name).join(', ')}
                      {attendees.length > 3 ? ` +${attendees.length - 3}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-neutral-500">{formatDate(m.created_at)}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{formatDuration(m.duration_seconds)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
