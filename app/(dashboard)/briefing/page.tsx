import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UpcomingMeetings from '@/components/UpcomingMeetings'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

interface ActionItem {
  text: string
  owner?: string
  due?: string
}

interface MeetingWithActions {
  id: number
  title: string
  actionItems: ActionItem[]
}

export default async function BriefingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = (user?.user_metadata?.full_name as string ?? 'você').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const last7Start = new Date(today)
  last7Start.setDate(last7Start.getDate() - 7)

  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  const [{ data: todayMeetings }, { data: recentMeetings }, { data: recentContacts }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees')
      .gte('created_at', todayIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('id, title, created_at, duration_seconds, enhancement, attendees')
      .gte('created_at', last7Start.toISOString())
      .lt('created_at', todayIso)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('contacts')
      .select('id, name, email, meeting_count, last_seen')
      .gte('last_seen', last7Start.toISOString())
      .order('last_seen', { ascending: false })
      .limit(6),
    supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, meeting_link, attendees, provider')
      .gte('start_at', todayIso)
      .lte('start_at', in7Days.toISOString())
      .order('start_at', { ascending: true })
      .limit(10),
  ])

  const todayCount = todayMeetings?.length ?? 0
  const todaySecs = (todayMeetings ?? []).reduce((acc, m) => acc + (m.duration_seconds ?? 0), 0)

  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Extrai action items de todas as reuniões (hoje + últimos 7 dias)
  const allMeetings = [...(todayMeetings ?? []), ...(recentMeetings ?? [])]
  const meetingsWithActions: MeetingWithActions[] = allMeetings
    .map(m => {
      let actionItems: ActionItem[] = []
      try {
        const enh = m.enhancement ? JSON.parse(m.enhancement) : null
        actionItems = Array.isArray(enh?.actionItems) ? enh.actionItems : []
      } catch {}
      return { id: m.id, title: m.title, actionItems }
    })
    .filter(m => m.actionItems.length > 0)

  const totalActions = meetingsWithActions.reduce((acc, m) => acc + m.actionItems.length, 0)

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">{greeting}, {firstName}</h1>
        <p className="text-sm text-neutral-500 mt-1 capitalize">{dateLabel}</p>
      </div>

      {/* Próximas reuniões do calendário */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Agenda</h2>
        <UpcomingMeetings events={upcomingEvents ?? []} />
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Reuniões hoje</p>
          <p className="text-3xl font-semibold text-white">{todayCount}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Gravadas hoje</p>
          <p className="text-3xl font-semibold text-white">
            {todaySecs > 0 ? formatDuration(todaySecs) : <span className="text-neutral-600 text-xl">—</span>}
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Pessoas esta semana</p>
          <p className="text-3xl font-semibold text-white">{recentContacts?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Reuniões de hoje */}
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Reuniões de hoje</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {todayCount === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma reunião gravada hoje ainda.</p>
            ) : (todayMeetings ?? []).map((m, i) => {
              let summary: string | null = null
              let attendees: { name: string }[] = []
              try { summary = m.enhancement ? JSON.parse(m.enhancement)?.summary : null } catch {}
              try { attendees = m.attendees ? (Array.isArray(m.attendees) ? m.attendees : JSON.parse(m.attendees)) : [] } catch {}
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className={`block px-5 py-4 hover:bg-white/[0.03] transition-colors ${i < todayCount - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white truncate">{m.title}</p>
                    <span className="text-xs text-neutral-600 shrink-0">{formatDuration(m.duration_seconds)}</span>
                  </div>
                  {attendees.length > 0 && (
                    <p className="text-xs text-neutral-600 mt-0.5">{attendees.slice(0, 3).map(a => a.name).join(', ')}</p>
                  )}
                  {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Pessoas encontradas esta semana */}
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Pessoas desta semana</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {!recentContacts || recentContacts.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma pessoa encontrada esta semana.</p>
            ) : recentContacts.map((c, i) => {
              const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              const colors = ['#6C8EFF', '#a78bfa', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4']
              return (
                <div key={c.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < recentContacts.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: colors[i % colors.length] }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-xs text-neutral-600 truncate">{c.email}</p>
                  </div>
                  <span className="text-xs text-neutral-600 shrink-0">{c.meeting_count} reuniões</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Ações pendentes */}
      {totalActions > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Ações pendentes
            </h2>
            <span className="text-[10px] bg-[#6C8EFF]/10 text-[#6C8EFF] border border-[#6C8EFF]/20 px-2 py-0.5 rounded-full">
              {totalActions} {totalActions === 1 ? 'ação' : 'ações'}
            </span>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {meetingsWithActions.map((meeting, mi) =>
              meeting.actionItems.map((action, ai) => {
                const isLast = mi === meetingsWithActions.length - 1 && ai === meeting.actionItems.length - 1
                return (
                  <Link
                    key={`${meeting.id}-${ai}`}
                    href={`/meetings/${meeting.id}`}
                    className={`flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group ${!isLast ? 'border-b border-white/[0.05]' : ''}`}
                  >
                    <span className="w-4 h-4 rounded border border-white/20 shrink-0 mt-0.5 group-hover:border-[#6C8EFF]/40 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-300 leading-snug">{action.text}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {action.owner && (
                          <span className="text-xs text-neutral-600">{action.owner}</span>
                        )}
                        {action.due && (
                          <span className="text-xs text-[#6C8EFF]/70">{action.due}</span>
                        )}
                        <span className="text-[10px] text-neutral-700 truncate">{meeting.title}</span>
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Reuniões recentes (últimos 7 dias) */}
      {(recentMeetings?.length ?? 0) > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Últimos 7 dias</h2>
            <Link href="/meetings" className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">Ver todas →</Link>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {(recentMeetings ?? []).map((m, i) => {
              let attendees: { name: string }[] = []
              try { attendees = m.attendees ? (Array.isArray(m.attendees) ? m.attendees : JSON.parse(m.attendees)) : [] } catch {}
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className={`flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors ${i < (recentMeetings?.length ?? 0) - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.title}</p>
                    {attendees.length > 0 && (
                      <p className="text-xs text-neutral-600 mt-0.5 truncate">{attendees.slice(0, 3).map(a => a.name).join(', ')}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-neutral-500">{new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    <p className="text-xs text-neutral-700">{formatDuration(m.duration_seconds)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Briefing IA — em breve */}
      <div>
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Briefing gerado por IA</h2>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Em breve você receberá aqui um resumo gerado por IA com contexto das reuniões do dia e sugestões de follow-up. Faz parte da <span className="text-[#6C8EFF]">Fase 12</span> do roadmap.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] bg-[#6C8EFF]/10 text-[#6C8EFF] border border-[#6C8EFF]/20 px-2 py-1 rounded-full">Em breve</span>
            <span className="text-xs text-neutral-600">Email matinal · Resumo noturno · Alertas de ações</span>
          </div>
        </div>
      </div>

    </div>
  )
}
