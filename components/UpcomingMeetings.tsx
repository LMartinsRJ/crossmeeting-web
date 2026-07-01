'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

export interface CalendarEvent {
  id: string
  title: string
  start_at: string
  end_at: string
  meeting_link: string | null
  attendees: { name: string; email: string }[] | null
  provider: string
}

const PROVIDER_ICON: Record<string, string> = {
  google: '📅', microsoft: '📆', granola: '🌾',
  zoom: '💙', teams: '🟦', meet: '🟩',
}

function timeLabel(startMs: number, endMs: number, now: number): {
  status: 'live' | 'soon' | 'today' | 'tomorrow' | 'week' | 'past'
  label: string
} {
  const diffStart = startMs - now
  const diffEnd   = endMs - now

  if (diffEnd < 0)          return { status: 'past',     label: 'Encerrada' }
  if (diffStart <= 0)       return { status: 'live',     label: 'Em andamento' }
  if (diffStart <= 10 * 60_000) return { status: 'soon', label: `Em ${Math.ceil(diffStart / 60_000)} min` }

  const startDate = new Date(startMs)
  const nowDate   = new Date(now)

  const sameDay = startDate.toDateString() === nowDate.toDateString()
  const tomorrow = new Date(nowDate); tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = startDate.toDateString() === tomorrow.toDateString()

  const time = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (sameDay)    return { status: 'today',    label: time }
  if (isTomorrow) return { status: 'tomorrow', label: `Amanhã ${time}` }
  return {
    status: 'week',
    label: startDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + time,
  }
}

function duration(startMs: number, endMs: number) {
  const min = Math.round((endMs - startMs) / 60_000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

// ── Recording confirmation modal ──────────────────────────────────────────────

interface RecordingModalProps {
  ev: CalendarEvent
  onClose: () => void
}

function RecordingModal({ ev, onClose }: RecordingModalProps) {
  const [launched, setLaunched] = useState(false)

  function enterWithRecording() {
    // Dispara o deep link — lança o Crossmeeting desktop e passa o título da reunião
    const params = new URLSearchParams({
      title: ev.title,
      meetingLink: ev.meeting_link ?? '',
    })
    window.location.href = `crossmeeting://record?${params.toString()}`

    // Aguarda 1.5s e abre o Meet/Zoom para dar tempo ao app abrir
    setTimeout(() => {
      window.open(ev.meeting_link!, '_blank', 'noopener,noreferrer')
    }, 1500)

    setLaunched(true)
  }

  function enterDirect() {
    window.open(ev.meeting_link!, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl p-6">

        {!launched ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#6C8EFF]/10 border border-[#6C8EFF]/20 flex items-center justify-center text-lg shrink-0">
                🎙️
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Quer gravar esta reunião?</p>
                <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{ev.title}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed mb-5">
              O Crossmeeting abre automaticamente e começa a capturar o áudio assim que você entrar na call.
            </p>

            <div className="space-y-2">
              <button
                onClick={enterWithRecording}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#6C8EFF] hover:bg-[#5a7af0] transition-colors text-left"
              >
                <span className="text-lg">🖥️</span>
                <div>
                  <p className="text-sm font-semibold text-white">Sim, gravar com Crossmeeting</p>
                  <p className="text-[11px] text-white/60">Lança o app e abre a call automaticamente</p>
                </div>
              </button>

              <button
                onClick={enterDirect}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors text-left"
              >
                <span className="text-lg">🔗</span>
                <div>
                  <p className="text-sm font-medium text-neutral-300">Entrar sem gravar</p>
                  <p className="text-[11px] text-neutral-600">Abre o link diretamente</p>
                </div>
              </button>
            </div>

            <button onClick={onClose} className="w-full mt-3 text-xs text-neutral-700 hover:text-neutral-500 transition-colors py-1">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Crossmeeting sendo aberto…</p>
                <p className="text-xs text-neutral-500 mt-0.5">A call abre em instantes</p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-neutral-400 leading-relaxed">
                Se o app não abrir automaticamente, verifique se o Crossmeeting está instalado no computador e clique em <span className="text-white">Abrir</span> no diálogo do sistema.
              </p>
            </div>

            <button
              onClick={() => { window.open(ev.meeting_link!, '_blank', 'noopener,noreferrer'); onClose() }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500 hover:bg-green-400 transition-colors font-semibold text-white text-sm"
            >
              Entrar na reunião →
            </button>

            <button onClick={onClose} className="w-full mt-2 text-xs text-neutral-700 hover:text-neutral-500 transition-colors py-1">
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface EventCardProps {
  ev: CalendarEvent
  now: number
  onEnterClick: (ev: CalendarEvent) => void
}

function EventCard({ ev, now, onEnterClick }: EventCardProps) {
  const startMs = new Date(ev.start_at).getTime()
  const endMs   = new Date(ev.end_at).getTime()
  const { status, label } = timeLabel(startMs, endMs, now)
  const attendees = Array.isArray(ev.attendees) ? ev.attendees : []
  const dur = duration(startMs, endMs)

  const isPast = status === 'past'
  const isLive = status === 'live'
  const isSoon = status === 'soon'

  return (
    <div className={`relative flex items-start gap-4 rounded-2xl px-5 py-4 border transition-all ${
      isLive
        ? 'bg-green-500/5 border-green-500/20'
        : isSoon
          ? 'bg-amber-500/5 border-amber-500/15'
          : isPast
            ? 'bg-transparent border-white/[0.04] opacity-50'
            : 'bg-white/[0.03] border-white/[0.06]'
    }`}>

      {/* Status indicator */}
      <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5 min-w-[52px]">
        {isLive ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <p className="text-[10px] font-semibold text-green-400 text-center leading-tight">Em<br/>andamento</p>
          </>
        ) : isSoon ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <p className="text-[10px] font-semibold text-amber-400 text-center leading-tight">{label}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-white">
              {new Date(startMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[10px] text-neutral-600">{dur}</p>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm leading-none">{PROVIDER_ICON[ev.provider] ?? '📋'}</span>
          <p className={`text-sm font-medium truncate ${isPast ? 'line-through text-neutral-600' : 'text-white'}`}>
            {ev.title}
          </p>
        </div>

        {attendees.length > 0 && (
          <p className="text-xs text-neutral-600 truncate">
            {attendees.slice(0, 4).map(a => a.name || a.email).join(' · ')}
            {attendees.length > 4 && ` +${attendees.length - 4}`}
          </p>
        )}

        {isLive && (
          <p className="text-[11px] text-green-400 mt-1">
            Encerra às {new Date(endMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{Math.round((endMs - now) / 60_000)} min restantes
          </p>
        )}
      </div>

      {/* Action */}
      {ev.meeting_link && !isPast && (
        <button
          onClick={() => onEnterClick(ev)}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            isLive
              ? 'bg-green-500 text-white hover:bg-green-400'
              : isSoon
                ? 'bg-amber-500 text-white hover:bg-amber-400'
                : 'bg-[#6C8EFF]/10 border border-[#6C8EFF]/20 text-[#6C8EFF] hover:bg-[#6C8EFF]/20'
          }`}
        >
          Entrar
        </button>
      )}

      {isPast && ev.meeting_link && (
        <span className="shrink-0 text-xs text-neutral-700 self-center">Encerrada</span>
      )}
    </div>
  )
}

interface Group {
  label: string
  events: CalendarEvent[]
}

export default function UpcomingMeetings({ events }: { events: CalendarEvent[] }) {
  const [now, setNow] = useState(() => Date.now())
  const [enteringEv, setEnteringEv] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const handleEnterClick = useCallback((ev: CalendarEvent) => {
    setEnteringEv(ev)
  }, [])

  const groups = useMemo<Group[]>(() => {
    if (!events.length) return []

    const todayStr    = new Date(now).toDateString()
    const tomorrowStr = (() => { const d = new Date(now); d.setDate(d.getDate() + 1); return d.toDateString() })()

    const buckets: Record<string, CalendarEvent[]> = {
      live:     [],
      soon:     [],
      today:    [],
      tomorrow: [],
      week:     [],
      past:     [],
    }

    for (const ev of events) {
      const startMs = new Date(ev.start_at).getTime()
      const endMs   = new Date(ev.end_at).getTime()
      const { status } = timeLabel(startMs, endMs, now)
      buckets[status].push(ev)
    }

    const result: Group[] = []
    if (buckets.live.length)     result.push({ label: '🔴 Agora',         events: buckets.live })
    if (buckets.soon.length)     result.push({ label: '⏰ Em breve',       events: buckets.soon })
    if (buckets.today.length)    result.push({ label: '📅 Mais tarde hoje', events: buckets.today })
    if (buckets.tomorrow.length) result.push({ label: '📅 Amanhã',         events: buckets.tomorrow })
    if (buckets.week.length)     result.push({ label: '📅 Esta semana',    events: buckets.week })
    if (buckets.past.length)     result.push({ label: 'Encerradas hoje',    events: buckets.past })

    return result
  }, [events, now])

  if (!groups.length) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <p className="text-sm text-neutral-600">Nenhuma reunião agendada para os próximos 7 dias.</p>
        <p className="text-xs text-neutral-700 mt-1">Abra o app Crossmeeting para sincronizar seu calendário.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {groups.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{group.label}</p>
            <div className="space-y-2">
              {group.events.map(ev => (
                <EventCard key={ev.id} ev={ev} now={now} onEnterClick={handleEnterClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {enteringEv && <RecordingModal ev={enteringEv} onClose={() => setEnteringEv(null)} />}
    </>
  )
}
