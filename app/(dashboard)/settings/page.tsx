import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import FirefliesCard from '@/components/FirefliesCard'
import GranolaCard from '@/components/GranolaCard'
import TeamsCard from '@/components/TeamsCard'
import GoogleMeetCard from '@/components/GoogleMeetCard'
import ZoomCard from '@/components/ZoomCard'
import OtterCard from '@/components/OtterCard'
import ApiKeyManager from '@/components/ApiKeyManager'
import WebhookManager from '@/components/WebhookManager'

const cloudUrl = 'https://gobnerbexyzktxhxuiju.supabase.co/functions/v1'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'profile' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verificar tokens OAuth vinculados
  const { data: profile } = await supabase
    .from('profiles')
    .select('microsoft_calendar_token, google_calendar_token')
    .maybeSingle()

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  const { data: fireflyesCred } = await supabase
    .from('integration_credentials')
    .select('status, last_synced_at, synced_count')
    .eq('source', 'fireflies')
    .maybeSingle()

  const { data: teamsCred } = await supabase
    .from('integration_credentials')
    .select('status, last_synced_at, synced_count')
    .eq('source', 'teams')
    .maybeSingle()

  const { data: meetCred } = await supabase
    .from('integration_credentials')
    .select('status, last_synced_at, synced_count')
    .eq('source', 'google_meet')
    .maybeSingle()

  const { data: zoomCred } = await supabase
    .from('integration_credentials')
    .select('status, last_synced_at, synced_count')
    .eq('source', 'zoom')
    .maybeSingle()

  const { data: otterCred } = await supabase
    .from('integration_credentials')
    .select('status, last_synced_at, synced_count')
    .eq('source', 'otter')
    .maybeSingle()

  const { data: granolaCred } = await supabase
    .from('integration_credentials')
    .select('status, last_synced_at, synced_count')
    .eq('source', 'granola')
    .maybeSingle()

  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('id, name, url, events, status, last_triggered_at, error_count, last_error')
    .order('created_at', { ascending: false })

  const tabs = [
    { id: 'profile', label: 'Perfil' },
    { id: 'api', label: 'API & Integrações' },
    { id: 'webhooks', label: 'Webhooks' },
  ]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-6">Configurações</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <Link
            key={t.id}
            href={`/settings?tab=${t.id}`}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white/[0.08] text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Perfil */}
      {tab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#6C8EFF] flex items-center justify-center text-lg font-semibold text-white">
                  {(user?.user_metadata?.full_name as string ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-white">{user?.user_metadata?.full_name ?? '—'}</p>
                <p className="text-sm text-neutral-500">{user?.email}</p>
              </div>
            </div>
            <div className="text-xs text-neutral-600">
              Conta gerenciada via Google OAuth. Para alterar nome ou foto, atualize seu perfil Google.
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-white mb-1">App desktop</h2>
            <p className="text-xs text-neutral-500 mb-4">
              O app Crossmeeting sincroniza automaticamente com a dashboard ao logar com a mesma conta Google.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs text-neutral-400">Sincronização ativa</span>
            </div>
          </div>
        </div>
      )}

      {/* API & Integrações */}
      {tab === 'api' && (
        <div>
          {/* Saída — API Keys */}
          <section className="mb-10">
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Saída — API Crossmeeting</h2>
              <p className="text-xs text-neutral-600 mt-1">
                Use sua chave para acessar reuniões via REST API ou conectar agentes de IA via MCP.
                Cada chave dá acesso somente às suas reuniões.
              </p>
            </div>

            <ApiKeyManager initialKeys={(keys ?? []) as any} />

            <div className="mt-6 space-y-3">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-xs text-neutral-400 mb-2.5 font-medium">REST API — reuniões</p>
                <pre className="text-[11px] text-neutral-500 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# Listar reuniões (até 100 com ?limit=N)
GET  ${cloudUrl}/meetings

# Busca full-text
GET  ${cloudUrl}/meetings?q=standup

# Reunião completa com transcrição e enhancement
GET  ${cloudUrl}/meetings/:id

# Autenticação
curl -H "Authorization: Bearer <sua-chave>" ${cloudUrl}/meetings`}</pre>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-xs text-neutral-400 mb-2.5 font-medium">MCP Remoto — para Claude Desktop, Claude Code e AI agents</p>
                <pre className="text-[11px] text-neutral-500 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# Adicionar ao Claude Code
claude mcp add crossmeeting \\
  --transport http \\
  --url ${cloudUrl}/mcp \\
  --header "Authorization: Bearer <sua-chave>"

# Tools disponíveis:
#   list_meetings       — lista suas reuniões (suporta ?q= e ?limit=)
#   get_meeting         — detalhes completos com transcrição
#   search_meetings     — full-text search
#   get_action_items    — lista ações pendentes/em andamento/concluídas
#   summarize_period    — resumo de reuniões em um intervalo de datas`}</pre>
              </div>
            </div>
          </section>

          {/* Entrada */}
          <section>
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Entrada — Fontes externas</h2>
              <p className="text-xs text-neutral-600 mt-1">Cole a API key de cada ferramenta para o Crossmeeting importar suas transcrições automaticamente.</p>
            </div>
            <div className="space-y-3">
              <FirefliesCard
                connected={fireflyesCred?.status === 'active'}
                lastSynced={fireflyesCred?.last_synced_at ?? null}
                syncedCount={fireflyesCred?.synced_count ?? 0}
              />
              <TeamsCard
                microsoftLinked={!!profile?.microsoft_calendar_token}
                lastSynced={teamsCred?.last_synced_at ?? null}
                syncedCount={teamsCred?.synced_count ?? 0}
              />
              <GoogleMeetCard
                googleLinked={!!profile?.google_calendar_token}
                lastSynced={meetCred?.last_synced_at ?? null}
                syncedCount={meetCred?.synced_count ?? 0}
              />
              <ZoomCard cred={zoomCred ?? null} />
              <OtterCard cred={otterCred ?? null} />
              <GranolaCard cred={granolaCred ?? null} />
            </div>
          </section>
        </div>
      )}

      {/* Webhooks */}
      {tab === 'webhooks' && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-medium text-white mb-1">Webhooks de saída</h2>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Receba notificações em tempo real quando uma ação é concluída ou o briefing matinal é enviado.
              O Crossmeeting faz um POST para a URL configurada com um payload JSON assinado.
            </p>
          </div>

          <WebhookManager initialWebhooks={(webhooks ?? []) as any} />

          <div className="mt-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-neutral-400 mb-3 font-medium">Formato do payload</p>
            <pre className="text-[11px] text-neutral-500 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`// Evento: ação concluída
{
  "event": "action_done",
  "timestamp": "2026-07-07T10:30:00Z",
  "data": {
    "id": 42,
    "text": "Enviar proposta para o cliente",
    "owner": "Leandro",
    "due_date": "2026-07-07",
    "meeting_id": 18,
    "completed_at": "2026-07-07T10:30:00Z"
  }
}

// Evento: briefing enviado
{
  "event": "briefing_ready",
  "timestamp": "2026-07-07T07:00:00Z",
  "data": {
    "date": "2026-07-07",
    "meeting_count": 2,
    "action_count": 3,
    "overdue_count": 1
  }
}

// Verificação de assinatura (quando secret configurado)
X-Crossmeeting-Signature: sha256=<HMAC-SHA256(secret, body)>`}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
