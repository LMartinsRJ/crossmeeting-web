'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type ViewMode = 'dia' | 'semana' | 'mes'

const HOUR_H = 56
const LABEL_W = 52
const WDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface CalendarEvent {
  id: string
  title: string
  start_at: string
  end_at: string
  meeting_link?: string | null
  attendees?: string[] | null
  provider?: string
}

function dayKey(d: Date) { return d.toISOString().slice(0, 10) }

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function minutesUntil(ts: string) {
  return Math.round((new Date(ts).getTime() - Date.now()) / 60_000)
}

function evStatus(ev: CalendarEvent) {
  const mins = minutesUntil(ev.start_at)
  if (mins <= 0 && new Date(ev.end_at).getTime() > Date.now()) return 'now'
  if (mins > 0 && mins <= 30) return 'soon'
  if (new Date(ev.end_at).getTime() < Date.now()) return 'past'
  return 'future'
}

function evColor(status: string) {
  if (status === 'now') return 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
  if (status === 'soon') return 'border-amber-400 bg-amber-500/15 text-amber-200'
  if (status === 'past') return 'border-white/10 bg-white/[0.03] text-neutral-500'
  return 'border-[#6C8EFF]/60 bg-[#6C8EFF]/15 text-neutral-200'
}

function weekStart(d: Date) {
  const s = new Date(d)
  s.setDate(d.getDate() - d.getDay())
  s.setHours(0, 0, 0, 0)
  return s
}

function weekDays(d: Date) {
  const s = weekStart(d)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(s)
    dd.setDate(s.getDate() + i)
    return dd
  })
}

function monthCells(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const cells: (Date | null)[] = Array(first.getDay()).fill(null)
  for (let i = 1; i <= last.getDate(); i++) cells.push(new Date(d.getFullYear(), d.getMonth(), i))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('semana')
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [lobbyEvent, setLobbyEvent] = useState<CalendarEvent | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const todayKey = dayKey(new Date())

  useEffect(() => {
    loadEvents()
  }, [])

  useEffect(() => {
    if (viewMode !== 'mes' && !loading) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 7 * HOUR_H
        }
      }, 50)
    }
  }, [viewMode, loading])

  async function loadEvents() {
    try {
      const supabase = createClient()
      const rangeStart = new Date()
      rangeStart.setDate(rangeStart.getDate() - 30)
      const rangeEnd = new Date()
      rangeEnd.setDate(rangeEnd.getDate() + 90)

      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, meeting_link, attendees, provider')
        .gte('start_at', rangeStart.toISOString())
        .lte('start_at', rangeEnd.toISOString())
        .order('start_at', { ascending: true })

      setEvents(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  function navigate(dir: 1 | -1) {
    const d = new Date(anchor)
    if (viewMode === 'dia') d.setDate(d.getDate() + dir)
    else if (viewMode === 'semana') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setAnchor(d)
  }

  function goToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d)
  }

  function periodLabel() {
    if (viewMode === 'dia') {
      const k = dayKey(anchor)
      if (k === todayKey) return 'Hoje'
      return anchor.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (viewMode === 'semana') {
      const ws = weekStart(anchor)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      if (ws.getMonth() === we.getMonth())
        return `${ws.getDate()}–${we.getDate()} de ${ws.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
      return `${ws.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  function eventsOnDay(d: Date) {
    const k = dayKey(d)
    return events.filter(e => {
      const s = new Date(e.start_at); s.setHours(0, 0, 0, 0)
      return dayKey(s) === k
    }).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  function TimeGrid({ days }: { days: Date[] }) {
    const now = new Date()
    const nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_H
    const showNowLine = days.some(d => dayKey(d) === todayKey)

    return (
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Day header row */}
        <div className="flex shrink-0 border-b border-white/[0.06]" style={{ paddingLeft: LABEL_W }}>
          {days.map(d => {
            const k = dayKey(d)
            const isToday = k === todayKey
            return (
              <div key={k} className="flex-1 flex flex-col items-center py-2 border-l border-white/[0.04] first:border-l-0">
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? 'text-[#6C8EFF]' : 'text-neutral-600'}`}>
                  {WDAYS[d.getDay()]}
                </span>
                <button
                  onClick={() => { setViewMode('dia'); setAnchor(d) }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold mt-0.5 transition-colors ${
                    isToday ? 'bg-[#6C8EFF] text-white' : 'text-neutral-300 hover:bg-white/[0.07]'
                  }`}
                >
                  {d.getDate()}
                </button>
              </div>
            )
          })}
        </div>

        {/* Scrollable time area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
          <div className="relative" style={{ height: 24 * HOUR_H }}>
            {hours.map(h => (
              <div key={h} className="absolute inset-x-0 flex" style={{ top: h * HOUR_H }}>
                <div className="shrink-0 text-[10px] text-neutral-700 text-right pr-2 -translate-y-[8px]" style={{ width: LABEL_W }}>
                  {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </div>
                <div className="flex-1 border-t border-white/[0.04]" />
              </div>
            ))}

            {hours.map(h => (
              <div key={`${h}h`} className="absolute inset-x-0 flex" style={{ top: h * HOUR_H + HOUR_H / 2 }}>
                <div style={{ width: LABEL_W }} />
                <div className="flex-1 border-t border-white/[0.02]" />
              </div>
            ))}

            {showNowLine && (
              <div className="absolute flex items-center z-20 pointer-events-none" style={{ top: nowTop - 1, left: LABEL_W, right: 0 }}>
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                <div className="flex-1 h-px bg-red-500/50" />
              </div>
            )}

            <div className="absolute inset-0 flex" style={{ left: LABEL_W }}>
              {days.map(d => {
                const dayEvs = eventsOnDay(d)
                return (
                  <div key={dayKey(d)} className="flex-1 relative border-l border-white/[0.04] first:border-l-0">
                    {dayEvs.map(ev => {
                      const startD = new Date(ev.start_at)
                      const endD = new Date(ev.end_at)
                      const topH = startD.getHours() + startD.getMinutes() / 60
                      const durH = (endD.getTime() - startD.getTime()) / 3_600_000
                      const top = topH * HOUR_H
                      const height = Math.max(durH * HOUR_H, 22)
                      const status = evStatus(ev)
                      return (
                        <div
                          key={ev.id}
                          className={`absolute left-0.5 right-0.5 rounded-lg border-l-[3px] px-1.5 py-0.5 text-left overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${evColor(status)}`}
                          style={{ top, height }}
                          onClick={() => setLobbyEvent(ev)}
                        >
                          <p className="text-[11px] font-semibold leading-tight truncate">{ev.title}</p>
                          {height > 30 && (
                            <p className="text-[10px] opacity-60 leading-tight">{fmtTime(ev.start_at)}–{fmtTime(ev.end_at)}</p>
                          )}
                          {status === 'now' && height > 44 && ev.meeting_link && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/15 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                              Entrar
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function MonthGrid() {
    const cells = monthCells(anchor)
    const weeks: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    const curMonth = anchor.getMonth()

    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="grid grid-cols-7 border-b border-white/[0.06] shrink-0">
          {WDAYS.map(w => (
            <div key={w} className="py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-neutral-600">{w}</div>
          ))}
        </div>
        <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-white/[0.04] last:border-b-0">
              {week.map((d, di) => {
                if (!d) return <div key={di} className="border-r border-white/[0.03] last:border-r-0 bg-black/10" />
                const k = dayKey(d)
                const isToday = k === todayKey
                const isThisMonth = d.getMonth() === curMonth
                const dayEvs = eventsOnDay(d)
                const shown = dayEvs.slice(0, 3)
                const more = dayEvs.length - 3
                return (
                  <div
                    key={k}
                    onClick={() => { setViewMode('dia'); setAnchor(d) }}
                    className={`border-r border-white/[0.03] last:border-r-0 p-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors flex flex-col ${!isThisMonth ? 'opacity-30' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 shrink-0 ${
                      isToday ? 'bg-[#6C8EFF] text-white' : 'text-neutral-400'
                    }`}>
                      {d.getDate()}
                    </div>
                    <div className="space-y-0.5 min-h-0">
                      {shown.map(ev => {
                        const status = evStatus(ev)
                        return (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); setLobbyEvent(ev) }}
                            className={`text-[10px] px-1 py-px rounded truncate leading-tight ${
                              status === 'past' ? 'bg-white/[0.04] text-neutral-600' :
                              status === 'now' ? 'bg-emerald-500/20 text-emerald-300' :
                              'bg-[#6C8EFF]/20 text-neutral-300'
                            }`}
                          >
                            {fmtTime(ev.start_at)} {ev.title}
                          </div>
                        )
                      })}
                      {more > 0 && <div className="text-[9px] text-neutral-600 pl-0.5">+{more} mais</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.05] shrink-0 bg-[#0E1117]">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <h1 className="text-[15px] font-semibold tracking-tight text-neutral-200 flex-1 capitalize select-none">
          {loading ? '...' : periodLabel()}
        </h1>

        <button
          onClick={goToday}
          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-100 border border-white/[0.08] hover:border-white/[0.15] rounded-lg transition-colors"
        >
          Hoje
        </button>

        <div className="flex items-center gap-0.5 bg-white/[0.05] rounded-lg p-0.5">
          {(['dia', 'semana', 'mes'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === v
                  ? 'bg-white/10 text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {v === 'mes' ? 'Mês' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* Event lobby modal */}
      {lobbyEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLobbyEvent(null)}>
          <div className="bg-[#16191F] border border-white/[0.08] rounded-3xl p-8 w-[480px] max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            {lobbyEvent.provider && (
              <div className="flex justify-center mb-5">
                <span className="text-xs px-3 py-1 rounded-full bg-white/[0.07] text-neutral-400 font-medium capitalize">
                  {lobbyEvent.provider === 'google' ? 'Google Calendar' : lobbyEvent.provider === 'microsoft' ? 'Microsoft Calendar' : lobbyEvent.provider}
                </span>
              </div>
            )}
            <h2 className="text-xl font-bold text-white text-center mb-1">{lobbyEvent.title}</h2>
            <p className="text-center text-sm text-neutral-400 mb-1">
              {fmtTime(lobbyEvent.start_at)} — {fmtTime(lobbyEvent.end_at)}
            </p>
            <p className={`text-center text-sm font-medium mb-6 ${
              evStatus(lobbyEvent) === 'now' ? 'text-emerald-400' :
              evStatus(lobbyEvent) === 'soon' ? 'text-amber-400' : 'text-neutral-500'
            }`}>
              · {evStatus(lobbyEvent) === 'now' ? 'Acontecendo agora' :
                 evStatus(lobbyEvent) === 'soon' ? `Em ${minutesUntil(lobbyEvent.start_at)} min` :
                 evStatus(lobbyEvent) === 'past' ? 'Já encerrado' :
                 (() => { const m = minutesUntil(lobbyEvent.start_at); return `Em ${Math.floor(m/60)}h${m%60>0?` ${m%60}min`:''}` })()}
            </p>
            {lobbyEvent.attendees && lobbyEvent.attendees.length > 0 && (
              <div className="bg-white/[0.04] rounded-2xl p-4 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-3">Participantes</p>
                <div className="space-y-2">
                  {lobbyEvent.attendees.map((a: any, i) => {
                    const label = typeof a === 'string' ? a : (a?.name ?? a?.email ?? '?')
                    return (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#6C8EFF]/20 flex items-center justify-center text-[10px] font-semibold text-[#6C8EFF] shrink-0">
                          {(label[0] ?? '?').toUpperCase()}
                        </div>
                        <span className="text-sm text-neutral-300 truncate">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {lobbyEvent.meeting_link && (
              <div className="bg-white/[0.04] rounded-2xl px-4 py-3 mb-6 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 shrink-0">Link</span>
                <span className="text-xs text-[#6C8EFF] truncate">{lobbyEvent.meeting_link}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setLobbyEvent(null)} className="flex-1 py-3 rounded-2xl bg-white/[0.05] text-neutral-400 text-sm font-medium hover:bg-white/[0.08] transition-colors">
                Cancelar
              </button>
              {lobbyEvent.meeting_link && (
                <button
                  onClick={() => { window.open(lobbyEvent!.meeting_link!, '_blank'); setLobbyEvent(null) }}
                  className={`flex-1 py-3 rounded-2xl text-white text-sm font-semibold transition-colors ${
                    evStatus(lobbyEvent) === 'now' || evStatus(lobbyEvent) === 'soon'
                      ? 'bg-emerald-500 hover:bg-emerald-400'
                      : 'bg-[#6C8EFF]/80 hover:bg-[#6C8EFF]'
                  }`}
                >
                  {evStatus(lobbyEvent) === 'now' || evStatus(lobbyEvent) === 'soon' ? 'Entrar e gravar' : 'Abrir link'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-sm text-neutral-600">
          <span className="w-3 h-3 rounded-full border-2 border-[#6C8EFF] border-t-transparent animate-spin" />
          Carregando eventos...
        </div>
      ) : events.length === 0 && viewMode !== 'mes' ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <p className="text-neutral-600 text-sm">Nenhum evento no calendário.</p>
          <p className="text-neutral-700 text-xs">Conecte seu Google Calendar ou Microsoft Calendar para ver seus eventos aqui.</p>
        </div>
      ) : (
        <>
          {viewMode === 'dia'    && <TimeGrid days={[anchor]} />}
          {viewMode === 'semana' && <TimeGrid days={weekDays(anchor)} />}
          {viewMode === 'mes'    && <MonthGrid />}
        </>
      )}
    </div>
  )
}
