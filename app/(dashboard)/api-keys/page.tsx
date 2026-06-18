import { createClient } from '@/lib/supabase/server'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, created_at, last_used_at, revoked_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  const cloudUrl = 'https://gobnerbexyzktxhxuiju.supabase.co/functions/v1'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">API & MCP</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Sua chave de API autentica tanto a API REST quanto o MCP remoto. Ela é gerada automaticamente pelo app desktop.
      </p>

      {/* Chaves ativas */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Chaves ativas</h2>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          {!keys || keys.length === 0 ? (
            <p className="text-sm text-neutral-600 p-5">
              Nenhuma chave encontrada. Abra o app desktop e faça login para gerar uma chave automaticamente.
            </p>
          ) : keys.map((k, i) => (
            <div key={k.id} className={`px-5 py-4 ${i < keys.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{k.name}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Criada em {new Date(k.created_at).toLocaleDateString('pt-BR')}
                    {k.last_used_at && ` · Último uso ${new Date(k.last_used_at).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-1 rounded-full">Ativa</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API REST */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">API REST Cloud</h2>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <pre className="text-[11px] text-neutral-400 font-mono leading-relaxed overflow-x-auto">{`GET ${cloudUrl}/meetings
GET ${cloudUrl}/meetings/:id
GET ${cloudUrl}/meetings?q=busca

curl -H "Authorization: Bearer <sua-chave>" \\
  ${cloudUrl}/meetings`}</pre>
        </div>
      </div>

      {/* MCP Cloud */}
      <div>
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">MCP Remoto Cloud</h2>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-3">
            Conecte o Claude Desktop ou Claude Code ao Crossmeeting via nuvem, sem o app aberto.
          </p>
          <pre className="text-[11px] text-neutral-400 font-mono leading-relaxed overflow-x-auto">{`# Claude Code
claude mcp add crossmeeting-cloud \\
  --transport http \\
  --url ${cloudUrl}/mcp \\
  --header "Authorization: Bearer <sua-chave>"`}</pre>
        </div>
      </div>
    </div>
  )
}
