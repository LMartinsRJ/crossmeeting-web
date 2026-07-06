import { createClient } from '@/lib/supabase/server'
import { parseEnhancementSummary } from '@/lib/parsers'

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default async function BriefingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = (user?.user_metadata?.full_name as string ?? 'você').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees, space_id')
    .gte('created_at', thisMonthStart)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, meeting_count, last_seen')
    .order('last_seen', { ascending: false })
    .limit(5)

  const totalMeetings = meetings?.length ?? 0
  const totalMinutes = Math.round((meetings ?? []).reduce((acc, m) => acc + (m.duration_seconds ?? 0), 0) / 60)
  // Início mostra só reuniões sem pasta — uma vez categorizada, a reunião só aparece
  // dentro da pasta dela (igual ao desktop/Android). As métricas acima continuam
  // contando todas as reuniões do mês, categorizadas ou não.
  const recentMeetings = (meetings ?? []).filter(m => m.space_id == null).slice(0, 5)

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">{greeting}, {firstName}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Reuniões este mês</p>
          <p className="text-3xl font-semibold text-white">{totalMeetings}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Horas gravadas</p>
          <p className="text-3xl font-semibold text-white">{Math.floor(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? ` ${totalMinutes % 60}min` : ''}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Pessoas encontradas</p>
          <p className="text-3xl font-semibold text-white">{contacts?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Reuniões recentes */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Reuniões recentes</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma reunião este mês.</p>
            ) : recentMeetings.map((m, i) => {
              const summary = parseEnhancementSummary(m.enhancement)
              return (
                <a
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className={`block px-5 py-4 hover:bg-white/[0.03] transition-colors ${i < recentMeetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <p className="text-sm font-medium text-white truncate">{m.title}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {formatDate(m.created_at)} · {formatDuration(m.duration_seconds)}
                    {m.word_count > 0 ? ` · ${m.word_count} palavras` : ''}
                  </p>
                  {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                </a>
              )
            })}
          </div>
        </div>

        {/* Pessoas chave */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Pessoas chave</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {!contacts || contacts.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhum contato encontrado ainda.</p>
            ) : contacts.map((c, i) => {
              const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              const colors = ['#6C8EFF', '#a78bfa', '#22c55e', '#f59e0b', '#ec4899']
              const color = colors[i % colors.length]
              return (
                <a
                  key={c.id}
                  href={`/people/${c.id}`}
                  className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors ${i < contacts.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: color }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-xs text-neutral-600 truncate">{c.email}</p>
                  </div>
                  <span className="text-[11px] text-neutral-600">{c.meeting_count} reuniões</span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
