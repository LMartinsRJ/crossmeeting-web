'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface OrgRow {
  id: string
  name: string
  plan: string
  createdAt: string
  memberCount: number
  settings: {
    ms365_enabled: boolean
    teams_meetings_enabled: boolean
    whatsapp_enabled: boolean
    ai_model: string
    feature_overrides: Record<string, unknown>
  } | null
}

interface AdminData {
  orgs: OrgRow[]
  totalUsers: number
  plans: Record<string, { label: string; features: Record<string, unknown> }>
}

const PLAN_COLORS: Record<string, string> = {
  individual: 'bg-neutral-700 text-neutral-300',
  pro:        'bg-blue-500/20 text-blue-400',
  enterprise: 'bg-[#6C8EFF]/20 text-[#6C8EFF]',
}

export default function GlobalAdminPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/orgs')
      .then(r => {
        if (r.status === 403) throw new Error('Acesso negado')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = (data?.orgs ?? []).filter(o =>
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.plan?.toLowerCase().includes(search.toLowerCase())
  )

  const byPlan = (data?.orgs ?? []).reduce<Record<string, number>>((acc, o) => {
    acc[o.plan] = (acc[o.plan] ?? 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div className="p-8 text-neutral-500 text-sm">Carregando painel global…</div>
  )

  if (error) return (
    <div className="p-8">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400 text-sm">{error}</div>
    </div>
  )

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🌐</span>
        <div>
          <h1 className="text-xl font-semibold text-white">Global Admin</h1>
          <p className="text-sm text-neutral-500">Visão completa de todas as organizações do Crossmeeting</p>
        </div>
        <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 font-semibold px-2 py-1 rounded-full uppercase tracking-wide">
          Super Admin
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Organizações" value={data?.orgs.length ?? 0} color="text-white" />
        <StatCard label="Usuários totais" value={data?.totalUsers ?? 0} color="text-blue-400" />
        <StatCard label="Enterprise" value={byPlan['enterprise'] ?? 0} color="text-[#6C8EFF]" />
        <StatCard label="Pro" value={byPlan['pro'] ?? 0} color="text-blue-400" />
      </div>

      {/* Tabela de orgs */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white flex-1">Organizações</h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por nome ou plano…"
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-[#6C8EFF]/40 w-56"
          />
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-[11px] text-neutral-600 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left px-5 py-3 font-medium">Organização</th>
              <th className="text-left px-4 py-3 font-medium">Plano</th>
              <th className="text-center px-4 py-3 font-medium">Membros</th>
              <th className="text-center px-4 py-3 font-medium">Integrações</th>
              <th className="text-left px-4 py-3 font-medium">Modelo IA</th>
              <th className="text-left px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-neutral-600 text-sm">
                  Nenhuma organização encontrada
                </td>
              </tr>
            )}
            {filtered.map(org => (
              <tr key={org.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3.5">
                  <div className="text-sm font-medium text-white">{org.name ?? '—'}</div>
                  <div className="text-[11px] text-neutral-600 font-mono mt-0.5">{org.id.slice(0, 8)}…</div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${PLAN_COLORS[org.plan] ?? 'bg-neutral-700 text-neutral-400'}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="text-sm text-neutral-300">{org.memberCount}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <IntegBadge active={org.settings?.ms365_enabled ?? false} label="M365" />
                    <IntegBadge active={org.settings?.teams_meetings_enabled ?? false} label="Teams" />
                    <IntegBadge active={org.settings?.whatsapp_enabled ?? false} label="WA" />
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-neutral-500 font-mono">
                    {(org.settings?.ai_model ?? 'haiku').replace('claude-', '').replace('-20251001', '')}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-neutral-600">
                    {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <Link
                    href={`/admin/orgs/${org.id}`}
                    className="text-[11px] text-[#6C8EFF] hover:text-white transition-colors font-medium"
                  >
                    Detalhes →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Planos */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Planos disponíveis</h2>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(data?.plans ?? {}).map(([key, plan]) => (
            <div key={key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${PLAN_COLORS[key] ?? 'bg-neutral-700 text-neutral-400'}`}>
                  {plan.label}
                </span>
              </div>
              <div className="space-y-1">
                {Object.entries(plan.features).filter(([k]) => k !== 'max_members').map(([feat, enabled]) => (
                  <div key={feat} className="flex items-center gap-2 text-xs">
                    <span className={enabled ? 'text-green-400' : 'text-neutral-700'}>
                      {enabled ? '✓' : '✗'}
                    </span>
                    <span className={enabled ? 'text-neutral-400' : 'text-neutral-700'}>
                      {feat.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs pt-1 border-t border-white/[0.06] mt-2">
                  <span className="text-neutral-600">Membros:</span>
                  <span className="text-neutral-400">
                    {plan.features.max_members == null ? 'ilimitado' : String(plan.features.max_members)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-neutral-600 mt-1">{label}</div>
    </div>
  )
}

function IntegBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded font-mono ${
      active ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.04] text-neutral-700'
    }`}>
      {label}
    </span>
  )
}
