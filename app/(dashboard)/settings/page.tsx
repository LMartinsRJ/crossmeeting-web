import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const cloudUrl = 'https://gobnerbexyzktxhxuiju.supabase.co/functions/v1'

const SOURCES = [
  { id: 'granola',     name: 'Granola',           description: 'Gere uma API key no Granola e cole aqui para importar suas transcrições.',           icon: '🌾', placeholder: 'grnl_xxxxxxxxxxxxxxxxxxxx' },
  { id: 'fireflies',   name: 'Fireflies.ai',       description: 'Cole sua API key do Fireflies para sincronizar transcrições e resumos.',              icon: '🔥', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
  { id: 'otter',       name: 'Otter.ai',           description: 'Cole sua API key do Otter para importar transcrições.',                              icon: '🦦', placeholder: 'ot_xxxxxxxxxxxxxxxxxxxx' },
  { id: 'zoom',        name: 'Zoom',               description: 'Conecte via OAuth ou Server-to-Server para importar gravações e transcrições.',       icon: '💙', placeholder: 'Account ID ou OAuth token' },
  { id: 'teams',       name: 'Microsoft Teams',    description: 'Importe transcrições geradas pelo Teams via Microsoft Graph API.',                    icon: '🟦', placeholder: 'Client ID / Tenant ID' },
  { id: 'google_meet', name: 'Google Meet',        description: 'Conecte via Google Workspace para importar transcrições do Meet.',                   icon: '🟩', placeholder: 'Service Account ou OAuth token' },
]

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'profile' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  const activeKey = keys?.[0]
  const tabs = [
    { id: 'profile', label: 'Perfil' },
    { id: 'api', label: 'API & Integrações' },
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
          {/* Saída */}
          <section className="mb-10">
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Saída — API Crossmeeting</h2>
              <p className="text-xs text-neutral-600 mt-1">Qualquer sistema externo pode consumir suas transcrições usando sua chave de API.</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden mb-4">
              {!activeKey ? (
                <p className="text-sm text-neutral-600 p-5">Nenhuma chave encontrada. Abra o app desktop e faça login para gerar automaticamente.</p>
              ) : (
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-white">{activeKey.name}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        Criada em {new Date(activeKey.created_at).toLocaleDateString('pt-BR')}
                        {activeKey.last_used_at && ` · Último uso ${new Date(activeKey.last_used_at).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-1 rounded-full">Ativa</span>
                  </div>
                  <div className="bg-black/30 rounded-xl px-4 py-2.5 font-mono text-xs text-neutral-400 flex items-center justify-between gap-4">
                    <span className="text-white">{activeKey.key_prefix ?? 'crossmeeting_••••••••••••...'}</span>
                    <span className="text-neutral-600 text-[10px] shrink-0">Authorization: Bearer &lt;chave-completa&gt;</span>
                  </div>
                  <p className="text-[11px] text-neutral-700 mt-2">A chave completa está em <span className="text-neutral-500">Configurações → API Key</span> no app desktop.</p>
                </div>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-4">
              <p className="text-xs text-neutral-500 mb-2 font-medium">REST API</p>
              <pre className="text-[11px] text-neutral-400 font-mono leading-relaxed overflow-x-auto">{`GET  ${cloudUrl}/meetings
GET  ${cloudUrl}/meetings/:id
GET  ${cloudUrl}/meetings?q=busca

curl -H "Authorization: Bearer <sua-chave>" ${cloudUrl}/meetings`}</pre>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-xs text-neutral-500 mb-2 font-medium">MCP Remoto (Claude / AI agents)</p>
              <pre className="text-[11px] text-neutral-400 font-mono leading-relaxed overflow-x-auto">{`claude mcp add crossmeeting-cloud \\
  --transport http \\
  --url ${cloudUrl}/mcp \\
  --header "Authorization: Bearer <sua-chave>"`}</pre>
            </div>
          </section>

          {/* Entrada */}
          <section>
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Entrada — Fontes externas</h2>
              <p className="text-xs text-neutral-600 mt-1">Cole a API key de cada ferramenta para o Crossmeeting importar suas transcrições automaticamente.</p>
            </div>
            <div className="space-y-3">
              {SOURCES.map((source) => (
                <div key={source.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-xl shrink-0 mt-0.5">{source.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white">{source.name}</p>
                        <span className="text-[10px] bg-white/[0.04] text-neutral-500 border border-white/[0.08] px-2 py-0.5 rounded-full shrink-0">Em breve</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{source.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={source.placeholder}
                      disabled
                      className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-neutral-600 placeholder-neutral-700 outline-none cursor-not-allowed"
                    />
                    <button disabled className="px-4 py-2 rounded-xl bg-white/[0.04] text-neutral-600 text-xs font-medium cursor-not-allowed border border-white/[0.06]">
                      Salvar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
