'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface OrgDetail {
  org: { id: string; name: string; plan: string; created_at: string }
  members: Array<{ user_id: string; role: string; created_at: string; name: string; email: string; lastSignIn: string | null }>
  settings: Record<string, unknown> | null
  briefings: Array<{ date: string; created_at: string }>
}

const PLANS = ['individual', 'pro', 'enterprise']
const AI_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai',    label: 'OpenAI (GPT)' },
  { value: 'deepseek',  label: 'DeepSeek' },
  { value: 'gemini',    label: 'Google Gemini' },
  { value: 'custom',    label: 'Personalizado' },
]
const AI_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (rápido, econômico)' },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet (mais capaz)' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o',      label: 'GPT-4o' },
  ],
  deepseek: [
    { value: 'deepseek-chat',     label: 'DeepSeek Chat' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro' },
  ],
  custom: [],
}

export default function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const router = useRouter()
  const [data, setData] = useState<OrgDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [plan, setPlan] = useState('')
  const [aiProvider, setAiProvider] = useState('anthropic')
  const [aiModel, setAiModel] = useState('')

  useEffect(() => {
    fetch(`/api/admin/orgs/${orgId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setPlan(d.org?.plan ?? 'individual')
        const p = d.settings?.ai_provider ?? 'anthropic'
        setAiProvider(p)
        setAiModel(d.settings?.ai_model ?? AI_MODELS['anthropic'][0].value)
      })
      .finally(() => setLoading(false))
  }, [orgId])

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/orgs/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, ai_provider: aiProvider, ai_model: aiModel }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-neutral-500 text-sm">Carregando…</div>
  if (!data?.org) return <div className="p-8 text-red-400 text-sm">Organização não encontrada.</div>

  const { org, members, settings, briefings } = data

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin')} className="text-neutral-600 hover:text-neutral-400 text-sm transition-colors">
          ← Voltar
        </button>
        <span className="text-neutral-700">/</span>
        <h1 className="text-lg font-semibold text-white">{org.name}</h1>
        <span className="text-[10px] bg-red-500/20 text-red-400 font-semibold px-2 py-0.5 rounded-full uppercase ml-auto">Super Admin</span>
      </div>

      {/* Info + configurações */}
      <div className="grid grid-cols-2 gap-4">

        {/* Info */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Informações</h2>
          <Row label="ID" value={<span className="font-mono text-xs text-neutral-500">{org.id}</span>} />
          <Row label="Criado em" value={new Date(org.created_at).toLocaleDateString('pt-BR')} />
          <Row label="Membros" value={members.length} />
          <Row label="Briefings" value={briefings.length} />
        </div>

        {/* Configurações editáveis */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Configurações do plano</h2>

          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Plano</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-[#6C8EFF]/40"
            >
              {PLANS.map(p => (
                <option key={p} value={p} className="bg-neutral-900">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Provedor de IA</label>
            <select
              value={aiProvider}
              onChange={e => {
                const p = e.target.value
                setAiProvider(p)
                setAiModel(AI_MODELS[p]?.[0]?.value ?? '')
              }}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-[#6C8EFF]/40"
            >
              {AI_PROVIDERS.map(p => (
                <option key={p.value} value={p.value} className="bg-neutral-900">{p.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-500">Modelo de IA padrão</label>
            {(AI_MODELS[aiProvider] ?? []).length > 0 ? (
              <select
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-[#6C8EFF]/40"
              >
                {(AI_MODELS[aiProvider] ?? []).map(m => (
                  <option key={m.value} value={m.value} className="bg-neutral-900">{m.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                placeholder="ex: llama-3.3-70b-versatile"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-700 focus:outline-none focus:border-[#6C8EFF]/40"
              />
            )}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2 bg-[#6C8EFF] hover:bg-[#5a7ef0] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Integrações (read-only por ora) */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Integrações configuradas</h2>
        <div className="grid grid-cols-3 gap-3">
          <IntegCard
            label="Microsoft 365"
            icon="🏢"
            active={!!(settings?.ms365_enabled)}
            detail={settings?.ms365_tenant_id ? `Tenant: ${String(settings.ms365_tenant_id).slice(0, 8)}…` : 'Não configurado'}
          />
          <IntegCard
            label="Teams Meetings"
            icon="📹"
            active={!!(settings?.teams_meetings_enabled)}
            detail="Geração automática de link"
          />
          <IntegCard
            label="WhatsApp"
            icon="💬"
            active={!!(settings?.whatsapp_enabled)}
            detail={settings?.whatsapp_instance ? `Instância: ${settings.whatsapp_instance}` : 'Não configurado'}
          />
        </div>
      </div>

      {/* Membros */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Membros ({members.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[11px] text-neutral-600 uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left px-5 py-3 font-medium">Usuário</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Último acesso</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id} className="border-b border-white/[0.04]">
                <td className="px-5 py-3">
                  <div className="text-sm text-white">{m.name}</div>
                  <div className="text-xs text-neutral-600">{m.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                    m.role === 'admin' ? 'bg-[#6C8EFF]/20 text-[#6C8EFF]' : 'bg-white/[0.06] text-neutral-500'
                  }`}>
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600">
                  {m.lastSignIn ? new Date(m.lastSignIn).toLocaleDateString('pt-BR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className="text-neutral-300">{value}</span>
    </div>
  )
}

function IntegCard({ label, icon, active, detail }: { label: string; icon: string; active: boolean; detail: string }) {
  return (
    <div className={`rounded-xl p-4 border ${active ? 'border-green-500/20 bg-green-500/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-sm font-medium text-neutral-300">{label}</span>
        <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded ${active ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.06] text-neutral-600'}`}>
          {active ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className="text-xs text-neutral-600">{detail}</p>
    </div>
  )
}
