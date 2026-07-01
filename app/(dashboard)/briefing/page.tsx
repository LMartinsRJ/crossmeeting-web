import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  // Service client para calendar_events (bypassa RLS — filtramos manualmente pelo profile_id)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const last7Start = new Date(today)
  last7Start.setDate(last7Start.getDate() - 7)

  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  // Resolve o profile_id determinístico a partir do email da sessão web
  const userEmail = user?.email ?? user?.user_metadata?.email as string | undefined
  let calendarProfileId: string | null = null
  if (userEmail) {
    const { data: profile } = await service
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle()
    calendarProfileId = profile?.id ?? null
  }

  const [{ data: todayMeetings }, { data: recentMeetings }, { data: recentContacts }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees')
      .gte('created_at', todayIso)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('id, title, created_at, duration_seconds, enhancement, attendees')
      .gte('created_at', last7Start.toISOString())
      .lt('created_at', todayIso)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('contacts')
      .select('id, name, email, meeting_count, last_seen')
      .gte('last_seen', last7Start.toISOString())
      .order('last_seen', { ascending: false })
      .limit(6),
    calendarProfileId
      ? service
          .from('calendar_events')
          .select('id, title, start_at, end_at, meeting_link, attendees, provider, recurring_event_id')
          .eq('user_id', calendarProfileId)
          .gte('start_at', todayIso)
          .lte('start_at', in7Days.toISOString())
          .order('start_at', { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // Detecta reuniões recorrentes entre os próximos eventos e busca a última gravação de cada
  const recurringUpcoming = (upcomingEvents ?? []).filter(e => e.recurring_event_id)
  const recurringContexts: {
    eventTitle: string
    eventStart: string
    meeting: { id: number; title: string; created_at: string; enhancement: string | null }
    pendingActions: { text: string; owner?: string; due?: string }[]
    resolvedActions: { text: string; owner?: string }[]
  }[] = []

  // Para cada recorrente único (por recurring_event_id), busca a última reunião gravada com título similar
  const seenRecurring = new Set<string>()
  for (const ev of recurringUpcoming) {
    const key = ev.recurring_event_id as string
    if (seenRecurring.has(key)) continue
    seenRecurring.add(key)

    // Busca a última reunião gravada com título similar (últimos 60 dias)
    const titleWords = ev.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
    const searchTerm = titleWords.slice(0, 3).join(' & ')
    const since60 = new Date(today); since60.setDate(since60.getDate() - 60)

    const { data: matchedMeetings } = await supabase
      .from('meetings')
      .select('id, title, created_at, enhancement')
      .ilike('title', `%${titleWords[0] ?? ev.title}%`)
      .gte('created_at', since60.toISOString())
      .lt('created_at', todayIso)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastMeeting = matchedMeetings?.[0]
    if (!lastMeeting) continue

    // Extrai ações da enhancement
    let allActions: { text: string; owner?: string; due?: string }[] = []
    try {
      const enh = lastMeeting.enhancement ? JSON.parse(lastMeeting.enhancement) : null
      allActions = Array.isArray(enh?.actionItems) ? enh.actionItems : []
    } catch {}

    // Busca action_items resolvidos (done_at não nulo) desta reunião
    const { data: doneItems } = await supabase
      .from('action_items')
      .select('text, owner, done_at')
      .eq('meeting_id', lastMeeting.id)
      .not('done_at', 'is', null)

    const resolvedTexts = new Set((doneItems ?? []).map((d: any) => d.text))
    const pendingActions = allActions.filter(a => !resolvedTexts.has(a.text))
    const resolvedActions = (doneItems ?? []).map((d: any) => ({ text: d.text, owner: d.owner }))

    recurringContexts.push({
      eventTitle: ev.title,
      eventStart: ev.start_at,
      meeting: lastMeeting,
      pendingActions,
      resolvedActions,
    })
  }

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

      {/* Contexto de reuniões recorrentes */}
      {recurringContexts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Reuniões recorrentes — contexto</h2>
            <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
              {recurringContexts.length} série{recurringContexts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {recurringContexts.map((ctx, i) => {
              const lastDate = new Date(ctx.meeting.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
              const nextDate = new Date(ctx.eventStart).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
              return (
                <div key={i} className="bg-white/[0.03] border border-purple-500/10 rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
                    <div>
                      <p className="text-sm font-semibold text-white">{ctx.eventTitle}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        Próxima: <span className="text-neutral-400">{nextDate}</span>
                        {' · '}Última gravação: <Link href={`/meetings/${ctx.meeting.id}`} className="text-[#6C8EFF] hover:opacity-80">{lastDate}</Link>
                      </p>
                    </div>
                    <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-full shrink-0">Recorrente</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
                    {/* Pendentes */}
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider mb-2.5">
                        ⏳ Pendente da última reunião {ctx.pendingActions.length > 0 ? `(${ctx.pendingActions.length})` : ''}
                      </p>
                      {ctx.pendingActions.length === 0 ? (
                        <p className="text-xs text-neutral-600">Nenhuma ação pendente — tudo resolvido!</p>
                      ) : (
                        <div className="space-y-2">
                          {ctx.pendingActions.slice(0, 4).map((a, ai) => (
                            <div key={ai} className="flex items-start gap-2">
                              <span className="w-3.5 h-3.5 rounded border border-amber-500/30 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="text-xs text-neutral-300 leading-snug">{a.text}</p>
                                {a.owner && <p className="text-[10px] text-neutral-600 mt-0.5">{a.owner}</p>}
                              </div>
                            </div>
                          ))}
                          {ctx.pendingActions.length > 4 && (
                            <p className="text-[10px] text-neutral-700">+{ctx.pendingActions.length - 4} mais</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resolvidos */}
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wider mb-2.5">
                        ✅ Resolvido desde a última vez {ctx.resolvedActions.length > 0 ? `(${ctx.resolvedActions.length})` : ''}
                      </p>
                      {ctx.resolvedActions.length === 0 ? (
                        <p className="text-xs text-neutral-600">Nenhum item marcado como resolvido ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {ctx.resolvedActions.slice(0, 4).map((a, ai) => (
                            <div key={ai} className="flex items-start gap-2">
                              <span className="text-green-500 text-xs shrink-0 mt-0.5">✓</span>
                              <p className="text-xs text-neutral-500 line-through leading-snug">{a.text}</p>
                            </div>
                          ))}
                          {ctx.resolvedActions.length > 4 && (
                            <p className="text-[10px] text-neutral-700">+{ctx.resolvedActions.length - 4} mais</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
