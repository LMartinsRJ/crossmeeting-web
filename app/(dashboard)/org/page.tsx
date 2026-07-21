'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface DashStats {
  open: number
  overdue: number
  done: number
  activeMembers: number
}

interface MemberStat {
  userId: string
  name: string
  role: string
  open: number
  overdue: number
  done: number
  completionRate: number | null
}

interface AreaStat {
  name: string
  open: number
  overdue: number
  done: number
  completionRate: number | null
}

interface Alert {
  owner: string
  area: string | null
  daysOverdue: number
}

interface DashData {
  stats: DashStats
  members: MemberStat[]
  areas: AreaStat[]
  alerts: Alert[]
}

interface AttentionMember {
  userId: string
  name: string
  role: string
  openCount: number
  avgScore: number
  topAction: { text: string; score: number; reasons: string[]; label: string; color: string } | null
}

interface CriticalAction {
  text: string
  owner: string
  area: string | null
  score: number
  reasons: string[]
  label: string
  color: string
}

interface AttentionData {
  members: AttentionMember[]
  topCritical: CriticalAction[]
}

function ScoreBadge({ score, label, color }: { score: number; label: string; color: string }) {
  const bg =
    score >= 70 ? 'bg-red-500/10 border-red-500/20' :
    score >= 45 ? 'bg-orange-500/10 border-orange-500/20' :
    score >= 25 ? 'bg-yellow-500/10 border-yellow-500/20' :
                  'bg-green-500/10 border-green-500/20'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${bg} ${color}`}>
      <span className="tabular-nums">{score}</span>
      <span className="font-normal opacity-70">{label}</span>
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-red-400' :
    score >= 45 ? 'bg-orange-400' :
    score >= 25 ? 'bg-yellow-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-neutral-400">{score}</span>
    </div>
  )
}

export default function OrgPage() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [attention, setAttention] = useState<AttentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/org/dashboard'),
      fetch('/api/org/attention'),
    ]).then(async ([dashRes, attRes]) => {
      if (dashRes.status === 403) { router.push('/briefing'); return }
      if (!dashRes.ok) throw new Error('Erro ao carregar dados')
      const [dash, att] = await Promise.all([dashRes.json(), attRes.json()])
      setData(dash)
      if (attRes.ok) setAttention(att)
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="text-neutral-600 text-sm">Carregando dashboard…</div>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
    </div>
  )

  if (!data) return null

  const { stats, members, areas, alerts } = data

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏢</span>
          <h1 className="text-xl font-semibold text-white">Dashboard Executivo</h1>
        </div>
        <p className="text-sm text-neutral-500">Visão cross-organização · Atualizado agora</p>
      </div>

      {/* Alertas críticos de prazo */}
      {alerts.length > 0 && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-400 text-sm font-semibold">⚠ Ações vencidas com alta prioridade</span>
          </div>
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-red-400 font-medium w-5 text-center">{a.daysOverdue}d</span>
              <span className="text-neutral-300">{a.owner}</span>
              {a.area && <span className="text-neutral-600">· {a.area}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Ações abertas',  value: stats.open,          color: 'text-yellow-400' },
          { label: 'Vencidas',       value: stats.overdue,       color: 'text-red-400'    },
          { label: 'Concluídas',     value: stats.done,          color: 'text-green-400'  },
          { label: 'Membros ativos', value: stats.activeMembers, color: 'text-blue-400'   },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className={`text-2xl font-bold mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Score de Atenção */}
      {attention && (
        <>
          {/* Top ações críticas */}
          {attention.topCritical.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Score de Atenção — Ações críticas</h2>
                <span className="text-[10px] bg-[#6C8EFF]/20 text-[#6C8EFF] px-2 py-0.5 rounded-full font-semibold">IA</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {attention.topCritical.map((a, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-start gap-4">
                    <div className="shrink-0 pt-0.5">
                      <ScoreBadge score={a.score} label={a.label} color={a.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{a.text}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-neutral-500">{a.owner}</span>
                        {a.area && <span className="text-xs text-neutral-600">{a.area}</span>}
                        {a.reasons.map((r, j) => (
                          <span key={j} className="text-xs text-orange-400/70">{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score por membro */}
          {attention.members.length > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.05]">
                <h2 className="text-sm font-semibold text-white">Score de Atenção — Por membro</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Membro', 'Score médio', 'Ações abertas', 'Ação mais crítica'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-neutral-600 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attention.members.map(m => (
                    <tr key={m.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-neutral-200 font-medium">{m.name}</td>
                      <td className="px-5 py-3">
                        {m.avgScore > 0 ? <ScoreBar score={m.avgScore} /> : <span className="text-neutral-700">—</span>}
                      </td>
                      <td className="px-5 py-3 text-neutral-400">{m.openCount}</td>
                      <td className="px-5 py-3 max-w-xs">
                        {m.topAction ? (
                          <div>
                            <p className="text-xs text-neutral-300 truncate">{m.topAction.text}</p>
                            {m.topAction.reasons[0] && (
                              <p className="text-[10px] text-orange-400/70 mt-0.5">{m.topAction.reasons[0]}</p>
                            )}
                          </div>
                        ) : <span className="text-neutral-700">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Por membro (stats) */}
      {members.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h2 className="text-sm font-semibold text-white">Ações por membro</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Membro', 'Função', 'Abertas', 'Vencidas', 'Concluídas', 'Taxa'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-neutral-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-neutral-200 font-medium">{m.name}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] bg-white/[0.06] text-neutral-500 px-2 py-0.5 rounded-full capitalize">{m.role}</span>
                  </td>
                  <td className="px-5 py-3 text-yellow-400">{m.open}</td>
                  <td className="px-5 py-3 text-red-400">{m.overdue || '—'}</td>
                  <td className="px-5 py-3 text-green-400">{m.done}</td>
                  <td className="px-5 py-3 text-neutral-400">
                    {m.completionRate !== null ? `${m.completionRate}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Por área */}
      {areas.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <h2 className="text-sm font-semibold text-white">Por área</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Área', 'Abertas', 'Vencidas', 'Concluídas', 'Taxa'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-neutral-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areas.map(a => (
                <tr key={a.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-neutral-200">{a.name}</td>
                  <td className="px-5 py-3 text-yellow-400">{a.open}</td>
                  <td className="px-5 py-3 text-red-400">{a.overdue || '—'}</td>
                  <td className="px-5 py-3 text-green-400">{a.done}</td>
                  <td className="px-5 py-3">
                    {a.completionRate !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-[#6C8EFF] rounded-full" style={{ width: `${a.completionRate}%` }} />
                        </div>
                        <span className="text-neutral-400 text-xs">{a.completionRate}%</span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members.length === 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-10 text-center">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-neutral-500 text-sm">Nenhuma ação registrada pelos membros ainda.</p>
        </div>
      )}
    </div>
  )
}
