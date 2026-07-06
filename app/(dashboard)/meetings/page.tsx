import { createClient } from '@/lib/supabase/server'
import { parseAttendees, parseEnhancementSummary } from '@/lib/parsers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import ImportTranscriptModal from '@/components/ImportTranscriptModal'
import DraggableMeetingRow from '@/components/DraggableMeetingRow'
import SpaceDropTargets from '@/components/SpaceDropTargets'
import MeetingSelectionProvider from '@/components/MeetingSelectionContext'
import MeetingMenuButton from '@/components/MeetingMenuButton'

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

type SearchParams = { q?: string; space?: string; from?: string; to?: string; dur?: string }

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, space, from, to, dur } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let myProfileId: string | null = null
  let spaces: { id: number; name: string; emoji: string }[] = []

  if (user?.email) {
    const [{ data: myProfile }, { data: mySpaces }] = await Promise.all([
      service.from('profiles').select('id').eq('email', user.email).single(),
      supabase.from('spaces').select('id, name, emoji').is('deleted_at', null).order('name'),
    ])
    myProfileId = myProfile?.id ?? null
    spaces = mySpaces ?? []
  }

  let query = supabase
    .from('meetings')
    .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees, user_id, space_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'portuguese' })
  if (space === 'none') query = query.is('space_id', null)
  else if (space) query = query.eq('space_id', Number(space))
  if (from) query = query.gte('created_at', new Date(from).toISOString())
  if (to) {
    const toDate = new Date(to)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt('created_at', toDate.toISOString())
  }

  let { data: meetings } = await query

  // Filtro por duração mínima (em minutos) — feito client-side pois Supabase não tem filtro em segundos direto
  if (dur && meetings) {
    const minSecs = Number(dur) * 60
    meetings = meetings.filter(m => m.duration_seconds >= minSecs)
  }

  const hasFilters = !!(q || space || from || to || dur)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Reuniões</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{meetings?.length ?? 0} encontradas</span>
          <ImportTranscriptModal />
        </div>
      </div>

      {/* Filtros */}
      <form className="mb-6 space-y-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar em títulos e transcrições..."
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-[#6C8EFF]/50 transition-colors"
        />
        <div className="flex flex-wrap gap-2">
          {/* Pasta */}
          <select
            name="space"
            defaultValue={space ?? ''}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none focus:border-[#6C8EFF]/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="">Todas as pastas</option>
            <option value="none">Sem pasta</option>
            {spaces.map(s => (
              <option key={s.id} value={String(s.id)}>{s.emoji} {s.name}</option>
            ))}
          </select>

          {/* Data de */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-600">De</span>
            <input
              type="date"
              name="from"
              defaultValue={from ?? ''}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none focus:border-[#6C8EFF]/50 transition-colors"
            />
          </div>

          {/* Data até */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-600">até</span>
            <input
              type="date"
              name="to"
              defaultValue={to ?? ''}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none focus:border-[#6C8EFF]/50 transition-colors"
            />
          </div>

          {/* Duração mínima */}
          <select
            name="dur"
            defaultValue={dur ?? ''}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 outline-none focus:border-[#6C8EFF]/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="">Qualquer duração</option>
            <option value="5">+ 5 min</option>
            <option value="15">+ 15 min</option>
            <option value="30">+ 30 min</option>
            <option value="60">+ 1 hora</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 border border-[#6C8EFF]/30 rounded-lg text-sm text-[#6C8EFF] transition-colors"
          >
            Filtrar
          </button>

          {hasFilters && (
            <a
              href="/meetings"
              className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-sm text-neutral-500 transition-colors"
            >
              Limpar
            </a>
          )}
        </div>
      </form>

      <SpaceDropTargets />

      {/* Lista */}
      <MeetingSelectionProvider>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {!meetings || meetings.length === 0 ? (
          <p className="text-sm text-neutral-600 p-6">
            {hasFilters ? 'Nenhuma reunião encontrada com esses filtros.' : 'Nenhuma reunião encontrada.'}
          </p>
        ) : meetings.map((m, i) => {
          const summary = parseEnhancementSummary(m.enhancement)
          const attendees = parseAttendees(m.attendees)

          return (
            <div key={m.id} className={`relative group flex items-center ${i < meetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
              <DraggableMeetingRow
                meetingId={m.id}
                href={`/meetings/${m.id}`}
                className="flex-1 min-w-0 px-6 py-4 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{m.title}</p>
                      {myProfileId && m.user_id !== myProfileId && (
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full shrink-0">
                          Compartilhada
                        </span>
                      )}
                    </div>
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
              </DraggableMeetingRow>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <MeetingMenuButton meetingId={m.id} title={m.title} />
              </div>
            </div>
          )
        })}
      </div>
      </MeetingSelectionProvider>
    </div>
  )
}
