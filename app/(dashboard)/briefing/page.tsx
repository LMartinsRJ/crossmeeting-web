export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import UpcomingMeetings from '@/components/UpcomingMeetings'
import BriefingActions from '@/components/BriefingActions'
import BriefingText from '@/components/BriefingText'
import type { ActionItem } from '@/components/ActionsClient'
import CalendarSyncTrigger from '@/components/CalendarSyncTrigger'
import { parseEnhancementSummary } from '@/lib/parsers'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

function getDueStatus(dueDateStr: string | null, doneAt: string | null) {
  if (doneAt) return 'done'
  if (!dueDateStr) return 'pending'
  const t = new Date().toISOString().slice(0, 10)
  if (dueDateStr < t) return 'overdue'
  if (dueDateStr === t) return 'today'
  return 'pending'
}


export default async function BriefingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = (user?.user_metadata?.full_name as string ?? 'você').split(' ')[0]

  // Sempre usar horário de Brasília independente do timezone do servidor
  const TZ = 'America/Sao_Paulo'
  const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  const hour = nowBRT.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()) // YYYY-MM-DD
  const [tyear, tmonth, tday] = todayStr.split('-').map(Number)
  const today = new Date(tyear, tmonth - 1, tday) // meia-noite local sem offset
  const todayIso = today.toISOString()

  const last7Start = new Date(today)
  last7Start.setDate(last7Start.getDate() - 7)

  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString()

  // profiles_select_own policy: retorna o perfil do usuário autenticado
  const { data: profileRow } = await supabase.from('profiles').select('id').maybeSingle()
  const profileId = profileRow?.id ?? null

  const [
    { data: todayMeetings },
    { data: recentMeetings },
    { data: allActions },
    { data: recentActionItems },
    { data: recentContacts },
    { data: upcomingEvents },
    { data: thisMonthMeetings },
    { data: lastMonthMeetingsData },
  ] = await Promise.all([
    supabase.from('meetings')
      .select('id, title, created_at, duration_seconds, enhancement')
      .gte('created_at', todayIso)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabase.from('meetings')
      .select('id, title, created_at, duration_seconds')
      .gte('created_at', last7Start.toISOString())
      .lt('created_at', todayIso)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),

    // action_items_own policy filtra automaticamente por auth_profile_id()
    supabase.from('action_items')
      .select('id, text, owner, due_date, done_at, meeting_id, meeting_title, created_at')
      .is('done_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50),

    supabase.from('action_items')
      .select('id, text, owner, due_date, done_at, meeting_title, created_at')
      .or(`created_at.gte.${last7Start.toISOString()},done_at.gte.${last7Start.toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase.from('contacts')
      .select('id, name, email, company, last_seen')
      .gte('last_seen', last7Start.toISOString())
      .order('last_seen', { ascending: false })
      .limit(8),

    // calendar_events_own policy filtra automaticamente por auth_profile_id()
    supabase.from('calendar_events')
      .select('id, title, start_at, end_at, meeting_link, attendees, provider, recurring_event_id')
      .gte('start_at', todayIso)
      .lte('start_at', in7Days.toISOString())
      .order('start_at', { ascending: true })
      .limit(10),

    supabase.from('meetings')
      .select('id, duration_seconds')
      .gte('created_at', thisMonthStart)
      .is('deleted_at', null),

    supabase.from('meetings')
      .select('id, duration_seconds')
      .gte('created_at', lastMonthStart)
      .lt('created_at', thisMonthStart)
      .is('deleted_at', null),
  ])

  const overdueActions = (allActions ?? []).filter(a => getDueStatus(a.due_date, a.done_at) === 'overdue')
  const todayActions = (allActions ?? []).filter(a => getDueStatus(a.due_date, a.done_at) === 'today')
  const urgentActions = [...overdueActions, ...todayActions] as ActionItem[]
  const pendingActions = (allActions ?? []) as ActionItem[]

  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })

  const todayEvents = ((upcomingEvents ?? []) as any[]).filter(e =>
    new Date(e.start_at) <= new Date(new Date().setHours(23, 59, 59, 999))
  )

  // Contagem de ações por reunião
  const actionCountByMeeting: Record<number, number> = {}
  for (const a of recentActionItems ?? []) {
    if ((a as any).meeting_id) {
      const mid = (a as any).meeting_id
      actionCountByMeeting[mid] = (actionCountByMeeting[mid] ?? 0) + 1
    }
  }

  // Feed unificado: reuniões + ações criadas + ações concluídas
  type FeedItem =
    | { type: 'meeting'; date: string; id: number; title: string; duration: number; actionCount: number }
    | { type: 'action_done'; date: string; text: string; owner: string | null; meetingTitle: string | null; dueDate: string | null }
    | { type: 'action_created'; date: string; text: string; owner: string | null; meetingTitle: string | null; dueDate: string | null }

  const feedItems: FeedItem[] = [
    ...(recentMeetings ?? []).map(m => ({
      type: 'meeting' as const,
      date: m.created_at,
      id: m.id,
      title: m.title,
      duration: m.duration_seconds,
      actionCount: actionCountByMeeting[m.id] ?? 0,
    })),
    ...(recentActionItems ?? [])
      .filter((a: any) => a.done_at && new Date(a.done_at) >= last7Start)
      .map((a: any) => ({
        type: 'action_done' as const,
        date: a.done_at,
        text: a.text,
        owner: a.owner ?? null,
        meetingTitle: a.meeting_title ?? null,
        dueDate: a.due_date ?? null,
      })),
    ...(recentActionItems ?? [])
      .filter((a: any) => !a.done_at && new Date(a.created_at) >= last7Start)
      .map((a: any) => ({
        type: 'action_created' as const,
        date: a.created_at,
        text: a.text,
        owner: a.owner ?? null,
        meetingTitle: a.meeting_title ?? null,
        dueDate: a.due_date ?? null,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)

  const todayCount = todayMeetings?.length ?? 0

  const monthMeetingCount = thisMonthMeetings?.length ?? 0
  const lastMonthMeetingCount = lastMonthMeetingsData?.length ?? 0
  const diffMeetings = monthMeetingCount - lastMonthMeetingCount
  const monthSecs = (thisMonthMeetings ?? []).reduce((acc, m) => acc + ((m as any).duration_seconds ?? 0), 0)
  const monthHours = Math.floor(monthSecs / 3600)
  const monthMinRem = Math.floor((monthSecs % 3600) / 60)
  const lastMonthSecs = (lastMonthMeetingsData ?? []).reduce((acc, m) => acc + ((m as any).duration_seconds ?? 0), 0)
  const diffHours = monthHours - Math.floor(lastMonthSecs / 3600)
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', timeZone: TZ })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <CalendarSyncTrigger />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">{greeting}, {firstName}</h1>
        <p className="text-sm text-neutral-500 mt-1 capitalize">{dateLabel}</p>
      </div>

      {/* ── Briefing de IA (carregado client-side para evitar timeout no Vercel) ── */}
      <BriefingText
        firstName={firstName}
        todayMeetings={todayMeetings ?? []}
        todayActions={todayActions}
        overdueActions={overdueActions}
        todayEvents={todayEvents}
        dateLabel={dateLabel}
      />

      {/* ── NOVO: Métricas de urgência ── */}
      {urgentActions.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs text-neutral-500 mb-2">Reuniões hoje</p>
              <p className="text-3xl font-semibold text-white">{todayCount}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs text-neutral-500 mb-2">Vencem hoje</p>
              <p className={`text-3xl font-semibold ${todayActions.length > 0 ? 'text-amber-400' : 'text-white'}`}>
                {todayActions.length}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs text-neutral-500 mb-2">Em atraso</p>
              <p className={`text-3xl font-semibold ${overdueActions.length > 0 ? 'text-red-400' : 'text-white'}`}>
                {overdueActions.length}
              </p>
            </div>
          </div>
          <BriefingActions
            initial={urgentActions}
            title="Ações — hoje e em atraso"
            linkHref="/actions"
            linkLabel="Ver todas →"
            maxVisible={10}
          />
        </div>
      )}

      {/* ── EXISTENTE: Agenda ── */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Agenda</h2>
        <UpcomingMeetings events={upcomingEvents ?? []} />
      </div>

      {/* ── EXISTENTE: Métricas originais + Reuniões de hoje / Pessoas da semana ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Reuniões hoje</p>
          <p className="text-3xl font-semibold text-white">{todayCount}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Gravadas hoje</p>
          {todayCount > 0 ? (
            <p className="text-sm text-neutral-400 mt-1 line-clamp-2">
              {(todayMeetings ?? [])[0]?.title}
              {todayCount > 1 ? ` +${todayCount - 1}` : ''}
            </p>
          ) : (
            <p className="text-neutral-700 mt-1">—</p>
          )}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Pessoas esta semana</p>
          <p className="text-3xl font-semibold text-white">{recentContacts?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Reuniões de hoje */}
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Reuniões de hoje</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {todayCount === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma reunião gravada hoje ainda.</p>
            ) : (
              (todayMeetings ?? []).map((m, i) => {
                const summary = parseEnhancementSummary(m.enhancement)
                return (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className={`block px-4 py-3.5 hover:bg-white/[0.03] transition-colors ${i < todayCount - 1 ? 'border-b border-white/[0.05]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white truncate">{m.title}</p>
                      <span className="text-xs text-neutral-600 shrink-0">{formatDuration(m.duration_seconds)}</span>
                    </div>
                    {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Pessoas desta semana */}
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Pessoas desta semana</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {!recentContacts || recentContacts.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma pessoa encontrada esta semana.</p>
            ) : (
              recentContacts.map((c, i) => {
                const initials = (c.name ?? c.email ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${i < recentContacts.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-[#6C8EFF]/20 flex items-center justify-center text-[11px] font-semibold text-[#6C8EFF] shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-300 truncate">{c.name ?? c.email}</p>
                      {c.company && <p className="text-xs text-neutral-600 truncate">{c.company}</p>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── EXISTENTE: Todas as ações pendentes ── */}
      <BriefingActions
        initial={pendingActions}
        title="Ações pendentes"
        linkHref="/actions"
        linkLabel={`${pendingActions.length} ações →`}
        maxVisible={8}
      />

      {/* ── Métricas do mês ── */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 capitalize">Este mês — {monthLabel}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-neutral-500 mb-2">Reuniões</p>
            <p className="text-3xl font-semibold text-white">{monthMeetingCount}</p>
            {diffMeetings !== 0 && (
              <p className={`text-xs mt-1 ${diffMeetings > 0 ? 'text-green-500' : 'text-red-400'}`}>
                {diffMeetings > 0 ? '+' : ''}{diffMeetings} vs mês anterior
              </p>
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-neutral-500 mb-2">Horas gravadas</p>
            <p className="text-3xl font-semibold text-white">
              {monthHours}h{monthMinRem > 0 ? <span className="text-lg text-neutral-400"> {monthMinRem}min</span> : ''}
            </p>
            {diffHours !== 0 && (
              <p className={`text-xs mt-1 ${diffHours > 0 ? 'text-green-500' : 'text-red-400'}`}>
                {diffHours > 0 ? '+' : ''}{diffHours}h vs mês anterior
              </p>
            )}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-neutral-500 mb-2">Média por reunião</p>
            <p className="text-3xl font-semibold text-white">
              {monthMeetingCount > 0 ? `${Math.round(monthSecs / 60 / monthMeetingCount)}` : '—'}
              {monthMeetingCount > 0 && <span className="text-lg text-neutral-400"> min</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Atividades dos últimos 7 dias ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Atividades dos últimos 7 dias</h2>
          <Link href="/meetings" className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">Ver todas →</Link>
        </div>
        {feedItems.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-sm text-neutral-600">Nenhuma atividade registrada neste período.</p>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {feedItems.map((item, i) => {
              const borderClass = i < feedItems.length - 1 ? 'border-b border-white/[0.05]' : ''
              const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

              if (item.type === 'meeting') return (
                <Link key={`m-${item.id}`} href={`/meetings/${item.id}`}
                  className={`flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors ${borderClass}`}>
                  <div className="w-2 h-2 rounded-full bg-[#6C8EFF] shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-300 truncate">
                      <span className="text-neutral-500">Reunião gravada —</span> {item.title}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {item.actionCount > 0 ? `${item.actionCount} ação${item.actionCount > 1 ? 'ões' : ''} gerada${item.actionCount > 1 ? 's' : ''} · ` : ''}{formatDuration(item.duration)}
                    </p>
                  </div>
                  <span className="text-[11px] text-neutral-700 shrink-0 mt-0.5">{fmtDate(item.date)}</span>
                </Link>
              )

              if (item.type === 'action_done') return (
                <div key={`ad-${i}`}
                  className={`flex items-start gap-3 px-5 py-3.5 ${borderClass}`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-300 truncate">
                      <span className="text-neutral-500">Ação concluída —</span> {item.text}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {item.meetingTitle ?? ''}{item.owner ? ` · ${item.owner}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] text-neutral-700 shrink-0 mt-0.5">{fmtDate(item.date)}</span>
                </div>
              )

              return (
                <div key={`ac-${i}`}
                  className={`flex items-start gap-3 px-5 py-3.5 ${borderClass}`}>
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-300 truncate">
                      <span className="text-neutral-500">Ação criada —</span> {item.text}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {item.meetingTitle ?? ''}{item.owner ? ` · ${item.owner}` : ''}{item.dueDate ? ` — prazo ${new Date(item.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] text-neutral-700 shrink-0 mt-0.5">{fmtDate(item.date)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
