'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────
interface OrgInfo { id: string; name: string; plan: string; createdAt: string }
interface MemberInfo {
  userId: string; name: string; email: string; avatar: string | null
  lastSignIn: string | null; role: string; joinedAt: string
  calendar: { provider: string | null; hasToken: boolean; updatedAt: string | null } | null
  actions: { total: number; open: number; overdue: number }
}
interface InviteInfo { id: string; email: string; role: string; expires_at: string; created_at: string }
interface BriefingInfo { date: string; created_at: string; stats: Record<string, number> }
interface AdminData {
  org: OrgInfo; members: MemberInfo[]; invites: InviteInfo[]
  briefings: BriefingInfo[]; totalActions: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
const PLAN_LABEL: Record<string, string> = { individual: 'Individual', team: 'Team', enterprise: 'Enterprise' }
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Gerente', member: 'Membro' }
const CAL_ICON: Record<string, string> = { google: '📅', microsoft: '📆' }

function ago(iso: string | null) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  return `${d}d atrás`
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${color}`}>
      {label}
    </span>
  )
}

// ── Sub-pages ──────────────────────────────────────────────────────────────
function TabOrg({ d }: { d: AdminData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card title="Organização">
          <Row label="Nome"      value={d.org.name} />
          <Row label="Plano"     value={<Badge label={PLAN_LABEL[d.org.plan] ?? d.org.plan} color="bg-[#6C8EFF]/20 text-[#6C8EFF]" />} />
          <Row label="Criada em" value={new Date(d.org.createdAt).toLocaleDateString('pt-BR')} />
          <Row label="ID"        value={<code className="text-[10px] text-neutral-500 font-mono">{d.org.id}</code>} />
        </Card>
        <Card title="Resumo">
          <Row label="Membros ativos"   value={d.members.length} />
          <Row label="Convites pendentes" value={d.invites.length} />
          <Row label="Total de ações"   value={d.totalActions} />
          <Row label="Briefings gerados" value={d.briefings.length} />
        </Card>
      </div>
    </div>
  )
}

function TabMembers({ d, onReload }: { d: AdminData; onReload: () => void }) {
  async function changeRole(userId: string, role: string) {
    await fetch(`/api/org/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    onReload()
  }
  async function remove(userId: string) {
    if (!confirm('Remover este membro?')) return
    await fetch(`/api/org/members/${userId}`, { method: 'DELETE' })
    onReload()
  }

  return (
    <div className="space-y-6">
      <Card title={`Membros ativos (${d.members.length})`}>
        <table className="w-full text-sm mt-1">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {['Membro', 'Função', 'Calendário', 'Ações', 'Último acesso', ''].map(h => (
                <th key={h} className="pb-2 text-left text-xs text-neutral-600 font-medium pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.members.map(m => (
              <tr key={m.userId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {m.avatar
                      ? <img src={m.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                      : <div className="w-6 h-6 rounded-full bg-[#6C8EFF] flex items-center justify-center text-[9px] font-bold text-white">{m.name[0]}</div>
                    }
                    <div>
                      <p className="text-neutral-200 text-xs font-medium leading-tight">{m.name}</p>
                      <p className="text-neutral-600 text-[10px]">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.userId, e.target.value)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-neutral-300 focus:outline-none"
                  >
                    {['member','manager','admin'].map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="py-2.5 pr-4">
                  {m.calendar?.hasToken
                    ? <span className="text-xs text-green-400">{CAL_ICON[m.calendar.provider ?? ''] ?? '📅'} Conectado</span>
                    : <span className="text-xs text-neutral-600">— Não conectado</span>
                  }
                </td>
                <td className="py-2.5 pr-4">
                  <div className="text-xs">
                    <span className="text-yellow-400">{m.actions.open}</span>
                    <span className="text-neutral-700"> / </span>
                    <span className="text-neutral-500">{m.actions.total}</span>
                    {m.actions.overdue > 0 && <span className="text-red-400 ml-1">({m.actions.overdue}v)</span>}
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-neutral-600 text-xs">{ago(m.lastSignIn)}</td>
                <td className="py-2.5">
                  <button onClick={() => remove(m.userId)} className="text-[10px] text-neutral-700 hover:text-red-400 transition-colors">Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {d.invites.length > 0 && (
        <Card title={`Convites pendentes (${d.invites.length})`}>
          <table className="w-full text-sm mt-1">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['E-mail', 'Função', 'Expira em', 'Enviado'].map(h => (
                  <th key={h} className="pb-2 text-left text-xs text-neutral-600 font-medium pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.invites.map(inv => (
                <tr key={inv.id} className="border-b border-white/[0.03]">
                  <td className="py-2 pr-4 text-neutral-300 text-xs">{inv.email}</td>
                  <td className="py-2 pr-4"><Badge label={ROLE_LABEL[inv.role] ?? inv.role} color="bg-white/[0.06] text-neutral-500" /></td>
                  <td className="py-2 pr-4 text-neutral-500 text-xs">{new Date(inv.expires_at).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2 text-neutral-600 text-xs">{ago(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function TabBriefings({ d, orgId }: { d: AdminData; orgId: string }) {
  const { settings, loading: loadingSettings } = useOrgSettings()
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)
  const [savedNotif, setSavedNotif] = useState(false)

  useEffect(() => {
    if (!settings) return
    setEmailEnabled(settings.notifications?.morning_briefing_email ?? false)
  }, [settings])

  async function generate() {
    setGenerating(true)
    setMsg(null)
    const res = await fetch('/api/org/briefing', { method: 'POST' })
    const ok = res.ok
    setMsg(ok
      ? emailEnabled ? '✓ Briefing gerado e email enviado' : '✓ Briefing gerado com sucesso'
      : '✗ Erro ao gerar briefing'
    )
    setGenerating(false)
  }

  async function saveNotifSettings() {
    setSavingNotif(true)
    const current = settings?.notifications ?? {}
    await fetch('/api/org/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notifications: { ...current, morning_briefing_email: emailEnabled },
      }),
    })
    setSavingNotif(false)
    setSavedNotif(true)
    setTimeout(() => setSavedNotif(false), 2000)
  }

  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000)
    days.push(date.toISOString().split('T')[0])
  }
  const briefingByDate = Object.fromEntries(d.briefings.map(b => [b.date, b]))

  return (
    <div className="space-y-6">

      {/* Notificações por email */}
      <Card title="📧 Notificações por email">
        <p className="text-xs text-neutral-500 mb-4">
          Quando ativo, o briefing executivo é enviado por email a todos os administradores da organização
          logo após ser gerado (diariamente às <strong className="text-neutral-300">08:00 BRT</strong>).
        </p>
        {loadingSettings ? (
          <div className="text-neutral-600 text-xs">Carregando…</div>
        ) : (
          <div className="space-y-4">
            <Toggle
              label="Enviar briefing por email"
              checked={emailEnabled}
              onChange={setEmailEnabled}
            />
            {emailEnabled && (
              <div className="bg-[#6C8EFF]/[0.06] border border-[#6C8EFF]/20 rounded-lg p-3 text-xs text-neutral-400">
                O email será enviado para todos os membros com role <strong className="text-neutral-300">admin</strong> desta organização.
                Certifique-se de que o domínio de envio está verificado no Resend.
              </div>
            )}
            <SaveBtn saving={savingNotif} saved={savedNotif} onClick={saveNotifSettings} />
          </div>
        )}
      </Card>

      {/* Gerar on-demand */}
      <Card title="Gerar briefing">
        <p className="text-xs text-neutral-500 mb-4">
          Gerado automaticamente às <strong className="text-neutral-300">08:00 BRT</strong> todos os dias via pg_cron.
          Admins podem forçar a geração a qualquer hora.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-[#6C8EFF] hover:bg-[#5a7ef0] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generating ? 'Gerando…' : '✦ Gerar briefing de hoje'}
          </button>
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
        </div>
      </Card>

      {/* Histórico */}
      <Card title="Histórico (últimos 7 dias)">
        <div className="grid grid-cols-7 gap-2 mt-2">
          {days.map(day => {
            const b = briefingByDate[day]
            const label = new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })
            return (
              <div key={day} className={`rounded-lg p-2.5 text-center border ${b ? 'bg-green-500/[0.06] border-green-500/20' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                <div className={`text-lg mb-1 ${b ? '' : 'opacity-30'}`}>{b ? '📋' : '○'}</div>
                <div className="text-[10px] text-neutral-500">{label}</div>
                {b && <div className="text-[9px] text-green-400 mt-0.5">{new Date(b.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
            )
          })}
        </div>
        <a href="/org/briefing" className="mt-4 inline-block text-xs text-[#6C8EFF] hover:underline">
          Ver briefing do dia →
        </a>
      </Card>
    </div>
  )
}

function TabScore() {
  return (
    <div className="space-y-4">
      <Card title="Fatores do Score de Atenção">
        <p className="text-xs text-neutral-500 mb-4">
          O score 0–100 é calculado em tempo real para cada ação aberta. Pesos atuais:
        </p>
        <div className="space-y-3">
          {[
            { label: 'Urgência do prazo',          pts: 35, color: 'bg-red-400'    },
            { label: 'Prioridade declarada',        pts: 20, color: 'bg-orange-400' },
            { label: 'Tempo sem atualização',       pts: 20, color: 'bg-yellow-400' },
            { label: 'Taxa de atraso da área',      pts: 15, color: 'bg-blue-400'   },
            { label: 'Recorrência semântica (IA)',  pts: 10, color: 'bg-neutral-600', note: 'Em breve — requer embeddings' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <div className="w-32 shrink-0">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${f.color}`} style={{ width: `${f.pts}%` }} />
                </div>
              </div>
              <span className="text-xs text-neutral-300 w-5 text-right shrink-0">{f.pts}</span>
              <span className="text-xs text-neutral-400">{f.label}</span>
              {f.note && <span className="text-[10px] text-neutral-700">{f.note}</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-neutral-700 mt-4">Configuração de pesos customizados disponível no plano Enterprise.</p>
      </Card>

      <Card title="Thresholds de alerta">
        <div className="grid grid-cols-4 gap-3">
          {[
            { range: '70–100', label: 'Crítico',  color: 'text-red-400',    bg: 'bg-red-500/[0.06] border-red-500/20' },
            { range: '45–69',  label: 'Alto',     color: 'text-orange-400', bg: 'bg-orange-500/[0.06] border-orange-500/20' },
            { range: '25–44',  label: 'Médio',    color: 'text-yellow-400', bg: 'bg-yellow-500/[0.06] border-yellow-500/20' },
            { range: '0–24',   label: 'Baixo',    color: 'text-green-400',  bg: 'bg-green-500/[0.06] border-green-500/20' },
          ].map(t => (
            <div key={t.label} className={`rounded-lg p-3 border text-center ${t.bg}`}>
              <div className={`text-sm font-bold ${t.color}`}>{t.range}</div>
              <div className={`text-xs mt-0.5 ${t.color}`}>{t.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Integrações tab ────────────────────────────────────────────────────────
interface OrgSettings {
  ms365_tenant_id: string | null
  ms365_client_id: string | null
  ms365_enabled: boolean
  teams_meetings_enabled: boolean
  google_workspace_enabled: boolean
  whatsapp_url: string | null
  whatsapp_instance: string | null
  whatsapp_enabled: boolean
  ai_provider: string | null
  ai_model: string | null
  ai_custom_endpoint: string | null
  notifications: {
    morning_briefing?: boolean
    morning_briefing_email?: boolean
    evening_summary?: boolean
    pre_meeting?: boolean
  } | null
}

const AI_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai',    label: 'OpenAI (GPT)' },
  { value: 'deepseek',  label: 'DeepSeek' },
  { value: 'gemini',    label: 'Google Gemini' },
  { value: 'custom',    label: 'Personalizado' },
]

const AI_MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku — rápido e econômico' },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet — maior qualidade' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini — econômico' },
    { value: 'gpt-4o',      label: 'GPT-4o — maior qualidade' },
  ],
  deepseek: [
    { value: 'deepseek-chat',    label: 'DeepSeek Chat — uso geral' },
    { value: 'deepseek-reasoner',label: 'DeepSeek Reasoner — raciocínio' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash — rápido e econômico' },
    { value: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro — maior qualidade' },
  ],
  custom: [],
}

function useOrgSettings() {
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/org/settings')
      .then(r => r.json())
      .then(d => setSettings(d.settings ?? {}))
      .finally(() => setLoading(false))
  }, [])

  return { settings, loading, setSettings }
}

function TabIntegrations() {
  const { settings, loading } = useOrgSettings()
  const [form, setForm] = useState({
    ms365_tenant_id: '', ms365_client_id: '', ms365_client_secret: '',
    ms365_enabled: false, teams_meetings_enabled: false,
    whatsapp_url: '', whatsapp_instance: '', whatsapp_api_key: '', whatsapp_enabled: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (!settings) return
    setForm(f => ({
      ...f,
      ms365_tenant_id: settings.ms365_tenant_id ?? '',
      ms365_client_id: settings.ms365_client_id ?? '',
      ms365_enabled: settings.ms365_enabled ?? false,
      teams_meetings_enabled: settings.teams_meetings_enabled ?? false,
      whatsapp_url: settings.whatsapp_url ?? '',
      whatsapp_instance: settings.whatsapp_instance ?? '',
      whatsapp_enabled: settings.whatsapp_enabled ?? false,
    }))
  }, [settings])

  async function save(section: string, payload: Record<string, unknown>) {
    setSaving(true)
    await fetch('/api/org/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setSaved(section)
    setTimeout(() => setSaved(''), 2000)
  }

  if (loading) return <div className="text-neutral-600 text-sm">Carregando…</div>

  return (
    <div className="space-y-6">
      {/* Microsoft 365 */}
      <Card title="🏢 Microsoft 365">
        <p className="text-xs text-neutral-500 mb-4">
          Registre o Crossmeeting como aplicativo no Azure AD da sua organização para que o sistema possa
          escrever na agenda dos usuários e criar links Teams automaticamente.
        </p>
        <div className="space-y-3 mb-4">
          <Field label="Tenant ID" value={form.ms365_tenant_id}
            onChange={v => setForm(f => ({ ...f, ms365_tenant_id: v }))}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Field label="Client ID (App ID)" value={form.ms365_client_id}
            onChange={v => setForm(f => ({ ...f, ms365_client_id: v }))}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Field label="Client Secret" value={form.ms365_client_secret}
            onChange={v => setForm(f => ({ ...f, ms365_client_secret: v }))}
            placeholder={settings?.ms365_client_id ? '••••••••••••••••••• (já configurado)' : 'Cole o secret aqui'}
            type="password" />
        </div>
        <div className="flex items-center gap-4 mb-4">
          <Toggle label="Integração ativa" checked={form.ms365_enabled}
            onChange={v => setForm(f => ({ ...f, ms365_enabled: v }))} />
          <Toggle label="Criar links Teams automaticamente" checked={form.teams_meetings_enabled}
            onChange={v => setForm(f => ({ ...f, teams_meetings_enabled: v }))} />
        </div>
        <SaveBtn
          saving={saving}
          saved={saved === 'ms365'}
          onClick={() => save('ms365', {
            ms365_tenant_id: form.ms365_tenant_id,
            ms365_client_id: form.ms365_client_id,
            ...(form.ms365_client_secret ? { ms365_client_secret: form.ms365_client_secret } : {}),
            ms365_enabled: form.ms365_enabled,
            teams_meetings_enabled: form.teams_meetings_enabled,
          })}
        />
        <div className="mt-4 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
          <p className="text-[11px] text-neutral-600 font-semibold mb-1">Permissões necessárias no Azure AD</p>
          <ul className="text-[11px] text-neutral-700 space-y-0.5 list-disc list-inside">
            <li><code className="text-neutral-500">Calendars.ReadWrite</code> — escrever na agenda dos usuários</li>
            <li><code className="text-neutral-500">OnlineMeetings.ReadWrite.All</code> — criar links Teams</li>
            <li><code className="text-neutral-500">Mail.Send</code> — enviar convites por e-mail</li>
          </ul>
        </div>
      </Card>

      {/* WhatsApp */}
      <Card title="💬 WhatsApp (Evolution API)">
        <p className="text-xs text-neutral-500 mb-4">
          Para envio de notificações e alertas via WhatsApp usando Evolution API self-hosted.
        </p>
        <div className="space-y-3 mb-4">
          <Field label="URL da Evolution API" value={form.whatsapp_url}
            onChange={v => setForm(f => ({ ...f, whatsapp_url: v }))}
            placeholder="https://evolution.suaempresa.com" />
          <Field label="Nome da instância" value={form.whatsapp_instance}
            onChange={v => setForm(f => ({ ...f, whatsapp_instance: v }))}
            placeholder="crossmeeting" />
          <Field label="API Key" value={form.whatsapp_api_key}
            onChange={v => setForm(f => ({ ...f, whatsapp_api_key: v }))}
            placeholder={settings?.whatsapp_instance ? '••••••••••••••••••• (já configurado)' : 'Cole a API key aqui'}
            type="password" />
        </div>
        <div className="mb-4">
          <Toggle label="WhatsApp ativo" checked={form.whatsapp_enabled}
            onChange={v => setForm(f => ({ ...f, whatsapp_enabled: v }))} />
        </div>
        <SaveBtn
          saving={saving}
          saved={saved === 'whatsapp'}
          onClick={() => save('whatsapp', {
            whatsapp_url: form.whatsapp_url,
            whatsapp_instance: form.whatsapp_instance,
            ...(form.whatsapp_api_key ? { whatsapp_api_key: form.whatsapp_api_key } : {}),
            whatsapp_enabled: form.whatsapp_enabled,
          })}
        />
      </Card>
    </div>
  )
}

function TabIA() {
  const { settings, loading } = useOrgSettings()
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-haiku-4-5-20251001')
  const [customModel, setCustomModel] = useState('')
  const [customEndpoint, setCustomEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    const p = settings.ai_provider ?? 'anthropic'
    setProvider(p)
    setModel(settings.ai_model ?? 'claude-haiku-4-5-20251001')
    setCustomEndpoint(settings.ai_custom_endpoint ?? '')
    if (p === 'custom') setCustomModel(settings.ai_model ?? '')
  }, [settings])

  const isCustom = provider === 'custom'
  const predefinedModels = AI_MODELS[provider] ?? []

  async function save() {
    setSaving(true)
    const effectiveModel = isCustom ? customModel : model
    await fetch('/api/org/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ai_provider: provider,
        ai_model: effectiveModel,
        ...(apiKey ? { ai_api_key: apiKey } : {}),
        ...(isCustom ? { ai_custom_endpoint: customEndpoint } : {}),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="text-neutral-600 text-sm">Carregando…</div>

  return (
    <div className="space-y-6">
      <Card title="🤖 Provedor de IA">
        <p className="text-xs text-neutral-500 mb-4">
          Define qual IA é usada nos briefings, enhancement de transcrições e chat desta organização.
          Se não configurar uma API Key própria, o Crossmeeting usa a chave compartilhada.
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-500">Provedor</label>
            <div className="grid grid-cols-3 gap-2">
              {AI_PROVIDERS.map(p => (
                <button
                  key={p.value}
                  onClick={() => {
                    setProvider(p.value)
                    if (p.value !== 'custom') setModel(AI_MODELS[p.value]?.[0]?.value ?? '')
                  }}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    provider === p.value
                      ? 'border-[#6C8EFF]/40 bg-[#6C8EFF]/10 text-[#6C8EFF]'
                      : 'border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.12]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {isCustom ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-500">
                  Endpoint base <span className="text-neutral-700">(compatível com OpenAI — ex: https://minha-ia.com)</span>
                </label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={e => setCustomEndpoint(e.target.value)}
                  placeholder="https://api.exemplo.com"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-[#6C8EFF]/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-500">Nome do modelo</label>
                <input
                  type="text"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="ex: llama-3.3-70b-versatile"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-[#6C8EFF]/40"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-500">Modelo</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-[#6C8EFF]/40"
              >
                {predefinedModels.map(m => (
                  <option key={m.value} value={m.value} className="bg-neutral-900">{m.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-neutral-500">
              API Key própria <span className="text-neutral-700">(opcional — se vazio usa a chave do Crossmeeting)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={settings?.ai_model ? '••••••••••••••••••• (já configurado)' : 'sk-ant-... ou sk-... ou chave do provedor'}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-[#6C8EFF]/40"
            />
          </div>

          <SaveBtn saving={saving} saved={saved} onClick={save} />
        </div>
      </Card>

      <Card title="Configuração atual">
        <Row label="Provedor ativo"   value={<span className="font-mono text-xs text-[#6C8EFF]">{settings?.ai_provider ?? 'anthropic'}</span>} />
        <Row label="Modelo ativo"     value={<span className="font-mono text-xs text-neutral-400">{settings?.ai_model ?? 'claude-haiku-4-5-20251001'}</span>} />
        {settings?.ai_custom_endpoint && (
          <Row label="Endpoint custom" value={<span className="font-mono text-xs text-neutral-500 truncate max-w-[200px] block">{String(settings.ai_custom_endpoint)}</span>} />
        )}
        <Row label="API Key própria"  value={settings?.ai_model ? <span className="text-green-400 text-xs">✓ configurada</span> : <span className="text-neutral-600 text-xs">usando chave Crossmeeting</span>} />
      </Card>
    </div>
  )
}

// ── Field / Toggle / SaveBtn helpers ───────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder-neutral-700 focus:outline-none focus:border-[#6C8EFF]/40"
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
    >
      <div className={`w-8 h-4 rounded-full transition-colors relative ${checked ? 'bg-[#6C8EFF]' : 'bg-white/[0.1]'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      {label}
    </button>
  )
}

function SaveBtn({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 bg-[#6C8EFF] hover:bg-[#5a7ef0] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
    </button>
  )
}

// ── Shared components ──────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-xs text-neutral-200">{value}</span>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'org',            label: 'Organização',  icon: '🏢' },
  { id: 'members',        label: 'Membros',      icon: '👥' },
  { id: 'integrations',   label: 'Integrações',  icon: '🔌' },
  { id: 'ia',             label: 'IA',           icon: '🤖' },
  { id: 'briefings',      label: 'Briefings',    icon: '📋' },
  { id: 'score',          label: 'Score IA',     icon: '🎯' },
]

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('org')

  async function load() {
    const res = await fetch('/api/org/admin')
    if (res.status === 403) { router.push('/org'); return }
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="text-neutral-600 text-sm">Carregando painel…</div>
    </div>
  )

  if (!data) return null

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-xl font-semibold text-white">Painel Admin</h1>
          <Badge label={data.org.plan.toUpperCase()} color="bg-[#6C8EFF]/20 text-[#6C8EFF]" />
        </div>
        <p className="text-sm text-neutral-500">{data.org.name} · acesso restrito a administradores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white/[0.08] text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'org'          && <TabOrg d={data} />}
      {tab === 'members'      && <TabMembers d={data} onReload={load} />}
      {tab === 'integrations' && <TabIntegrations />}
      {tab === 'ia'           && <TabIA />}
      {tab === 'briefings'    && <TabBriefings d={data} orgId={data.org.id} />}
      {tab === 'score'        && <TabScore />}
    </div>
  )
}
