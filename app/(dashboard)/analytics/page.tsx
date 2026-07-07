'use client'

import { useState } from 'react'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PRESETS = [
  { label: 'Esta semana', days: 7 },
  { label: 'Este mês', days: 30 },
  { label: 'Últimos 3 meses', days: 90 },
  { label: 'Este ano', days: 365 },
]

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function dateRange(days: number) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days + 1)
  return { from: isoDate(from), to: isoDate(to) }
}

type AnalyticsData = {
  period: { from: string; to: string }
  meeting_count: number
  total_hours: number
  avg_duration_min: number
  by_weekday: number[]
  by_week: Record<string, number>
  top_participants: { name: string; count: number }[]
  actions: { pending: number; in_progress: number; done: number }
  action_total: number
  analysis: {
    headline: string
    paragraphs: string[]
    insights: string[]
    recommendations: string[]
  }
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState(1) // este mês
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    const range = useCustom
      ? { from: customFrom, to: customTo }
      : dateRange(PRESETS[preset].days)

    if (!range.from || !range.to) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(range),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Gráfico de barras por dia da semana (SVG inline)
  function WeekdayChart({ byWeekday }: { byWeekday: number[] }) {
    const max = Math.max(...byWeekday, 1)
    const H = 64
    return (
      <div className="flex items-end gap-2 h-20">
        {byWeekday.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[#6C8EFF]/60 transition-all"
              style={{ height: `${Math.max(4, (count / max) * H)}px` }}
            />
            <span className="text-[10px] text-neutral-600">{WEEKDAYS[i]}</span>
          </div>
        ))}
      </div>
    )
  }

  // Gráfico de linha por semana
  function WeekChart({ byWeek }: { byWeek: Record<string, number> }) {
    const entries = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b))
    if (entries.length < 2) return (
      <p className="text-xs text-neutral-600 text-center py-4">Dados insuficientes para o gráfico.</p>
    )
    const max = Math.max(...entries.map(([, v]) => v), 1)
    const W = 100 / (entries.length - 1)
    const H = 60
    const points = entries.map(([, v], i) => `${i * W},${H - (v / max) * H}`).join(' ')
    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 100 ${H + 16}`} className="w-full" preserveAspectRatio="none" style={{ height: 80 }}>
          <polyline
            points={points}
            fill="none"
            stroke="#6C8EFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {entries.map(([, v], i) => (
            <circle key={i} cx={i * W} cy={H - (v / max) * H} r="2" fill="#6C8EFF" />
          ))}
        </svg>
        <div className="flex justify-between text-[9px] text-neutral-700 mt-1">
          <span>{entries[0]?.[0]?.slice(5)}</span>
          <span>{entries[entries.length - 1]?.[0]?.slice(5)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Analytics</h1>
        <p className="text-sm text-neutral-500">Padrões de reuniões analisados pelo Claude.</p>
      </div>

      {/* Seletor de período */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-6">
        <p className="text-xs font-medium text-neutral-500 mb-3">Período de análise</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setPreset(i); setUseCustom(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !useCustom && preset === i
                  ? 'bg-[#6C8EFF]/20 text-[#6C8EFF] border border-[#6C8EFF]/30'
                  : 'bg-white/[0.03] text-neutral-500 border border-white/[0.06] hover:border-white/20'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setUseCustom(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              useCustom
                ? 'bg-[#6C8EFF]/20 text-[#6C8EFF] border border-[#6C8EFF]/30'
                : 'bg-white/[0.03] text-neutral-500 border border-white/[0.06] hover:border-white/20'
            }`}
          >
            Personalizado
          </button>
        </div>

        {useCustom && (
          <div className="flex gap-3 mb-4">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 outline-none focus:border-[#6C8EFF]/50 transition-colors" />
            <span className="text-neutral-600 self-center text-xs">até</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 outline-none focus:border-[#6C8EFF]/50 transition-colors" />
          </div>
        )}

        <button
          onClick={run}
          disabled={loading}
          className="px-5 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-sm font-medium border border-[#6C8EFF]/30 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Analisando…' : 'Analisar período'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-xs text-red-400">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-neutral-500 py-12 justify-center">
          <span className="animate-spin text-[#6C8EFF]">⟳</span>
          Claude está analisando suas reuniões…
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* Headline */}
          <div className="bg-gradient-to-r from-[#6C8EFF]/10 to-transparent border border-[#6C8EFF]/20 rounded-2xl p-5">
            <p className="text-xs text-[#6C8EFF] font-medium mb-1 uppercase tracking-wider">
              {data.period.from} → {data.period.to}
            </p>
            <p className="text-lg font-semibold text-white leading-snug">{data.analysis.headline}</p>
          </div>

          {/* Métricas principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Reuniões', value: data.meeting_count },
              { label: 'Horas totais', value: `${data.total_hours}h` },
              { label: 'Duração média', value: `${data.avg_duration_min}min` },
              { label: 'Ações criadas', value: data.action_total },
            ].map(m => (
              <div key={m.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{m.value}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-medium text-neutral-500 mb-4">Reuniões por dia da semana</p>
              <WeekdayChart byWeekday={data.by_weekday} />
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-medium text-neutral-500 mb-4">Reuniões por semana</p>
              <WeekChart byWeek={data.by_week} />
            </div>
          </div>

          {/* Participantes + Ações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.top_participants.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-xs font-medium text-neutral-500 mb-4">Participantes frequentes</p>
                <div className="space-y-2.5">
                  {data.top_participants.map(p => {
                    const pct = Math.round((p.count / data.meeting_count) * 100)
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-neutral-300 truncate">{p.name}</span>
                          <span className="text-neutral-600 shrink-0 ml-2">{p.count} reuniões</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full bg-[#6C8EFF]/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs font-medium text-neutral-500 mb-4">Status das ações</p>
              {data.action_total === 0 ? (
                <p className="text-xs text-neutral-600">Nenhuma ação criada no período.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Pendentes', value: data.actions.pending, color: 'bg-neutral-500/50' },
                    { label: 'Em andamento', value: data.actions.in_progress, color: 'bg-blue-500/50' },
                    { label: 'Concluídas', value: data.actions.done, color: 'bg-green-500/50' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-neutral-300">{label}</span>
                        <span className="text-neutral-600">{value} ({data.action_total ? Math.round(value / data.action_total * 100) : 0}%)</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${data.action_total ? (value / data.action_total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Análise Claude */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs font-medium text-neutral-500 mb-4">Análise</p>
            <div className="space-y-3">
              {data.analysis.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-neutral-300 leading-relaxed">{p}</p>
              ))}
            </div>
          </div>

          {/* Insights + Recomendações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.analysis.insights.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-xs font-medium text-neutral-500 mb-3">Padrões identificados</p>
                <ul className="space-y-2">
                  {data.analysis.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                      <span className="text-[#6C8EFF] mt-0.5 shrink-0">·</span>
                      {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.analysis.recommendations.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-xs font-medium text-neutral-500 mb-3">Recomendações</p>
                <ul className="space-y-2">
                  {data.analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                      <span className="text-green-500 mt-0.5 shrink-0">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
