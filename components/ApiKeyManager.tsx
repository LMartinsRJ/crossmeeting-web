'use client'

import { useState } from 'react'

type Key = { id: number; name: string; key_prefix: string; created_at: string; last_used_at: string | null }

export default function ApiKeyManager({ initialKeys }: { initialKeys: Key[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [newKeyName, setNewKeyName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null) // chave completa após geração
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<number | null>(null)

  async function generate() {
    setGenerating(true)
    setRevealed(null)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() || 'Chave da web' }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error); return }
      setRevealed(json.key)
      setNewKeyName('')
      // Adiciona à lista local com prefixo
      setKeys(prev => [{ id: Date.now(), name: newKeyName.trim() || 'Chave da web', key_prefix: json.prefix, created_at: new Date().toISOString(), last_used_at: null }, ...prev])
    } finally {
      setGenerating(false)
    }
  }

  async function copy() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function revoke(id: number) {
    setRevoking(id)
    try {
      await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      setKeys(prev => prev.filter(k => k.id !== id))
      if (revealed) setRevealed(null)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Chave revelada — só aparece imediatamente após a geração */}
      {revealed && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-green-400 mb-2 font-medium">Chave gerada — copie agora, não será exibida novamente.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-xs font-mono text-green-300 break-all">{revealed}</code>
            <button
              onClick={copy}
              className="px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium shrink-0 transition-colors"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* Gerar nova chave */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nome da chave (ex: n8n, Zapier)"
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/50 transition-colors"
        />
        <button
          onClick={generate}
          disabled={generating}
          className="px-4 py-2 rounded-xl bg-[#6C8EFF]/20 hover:bg-[#6C8EFF]/30 text-[#6C8EFF] text-xs font-medium border border-[#6C8EFF]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {generating ? 'Gerando…' : '+ Nova chave'}
        </button>
      </div>

      {/* Lista de chaves */}
      {keys.length === 0 ? (
        <p className="text-xs text-neutral-600 px-1">Nenhuma chave ativa.</p>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          {keys.map((k, i) => (
            <div key={k.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < keys.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">{k.name}</p>
                <p className="text-[11px] text-neutral-600 font-mono mt-0.5">{k.key_prefix}</p>
                <p className="text-[11px] text-neutral-700 mt-0.5">
                  Criada {new Date(k.created_at).toLocaleDateString('pt-BR')}
                  {k.last_used_at ? ` · Último uso ${new Date(k.last_used_at).toLocaleDateString('pt-BR')}` : ' · Nunca usada'}
                </p>
              </div>
              <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">Ativa</span>
              <button
                onClick={() => revoke(k.id)}
                disabled={revoking === k.id}
                className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
              >
                {revoking === k.id ? 'Revogando…' : 'Revogar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
