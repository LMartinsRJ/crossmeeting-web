'use client'

import { useState } from 'react'

interface Field {
  label: string
  value: string
  hint?: string
}

interface ApiConnectionCardProps {
  apiKey: string | null
}

const CLOUD_URL = 'https://gobnerbexyzktxhxuiju.supabase.co/functions/v1'

export default function ApiConnectionCard({ apiKey }: ApiConnectionCardProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(field: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(field)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  const keyDisplay = apiKey ?? 'crossmeeting_••••••  (gere uma chave acima)'
  const fields: Field[] = [
    {
      label: 'URL da Fonte (API)',
      value: `${CLOUD_URL}/meetings`,
      hint: 'Cole no campo "URL da Fonte" do sistema externo',
    },
    {
      label: 'API Key (Token de Acesso)',
      value: apiKey ?? '',
      hint: 'Cole no campo "API Key" do sistema externo',
    },
    {
      label: 'Nome do Header de Auth',
      value: 'Authorization',
      hint: 'Cabeçalho HTTP usado para autenticação',
    },
    {
      label: 'Formato do valor',
      value: apiKey ? `Bearer ${apiKey}` : 'Bearer <sua-chave>',
      hint: 'Valor completo do header — alguns sistemas pedem isso diretamente',
    },
  ]

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6C8EFF]/15 flex items-center justify-center text-sm">🔌</div>
        <div>
          <p className="text-sm font-semibold text-white">Parâmetros de Conexão</p>
          <p className="text-xs text-neutral-500">Cole esses valores em qualquer sistema que consuma transcrições via API (COS, n8n, Zapier…)</p>
        </div>
      </div>

      {/* Fields */}
      <div className="divide-y divide-white/[0.04]">
        {fields.map((f) => (
          <div key={f.label} className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{f.label}</span>
              <button
                onClick={() => copy(f.label, f.value)}
                disabled={!f.value || f.value.includes('••••')}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors
                  disabled:text-neutral-700 disabled:cursor-not-allowed
                  enabled:text-[#6C8EFF] enabled:hover:bg-[#6C8EFF]/10"
              >
                {copied === f.label ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-neutral-300 bg-black/20 rounded-lg px-3 py-2 flex-1 min-w-0 overflow-x-auto block whitespace-nowrap select-all">
                {f.value || keyDisplay}
              </code>
            </div>
            {f.hint && <p className="text-[10px] text-neutral-700 mt-1">{f.hint}</p>}
          </div>
        ))}
      </div>

      {/* Dica de polling */}
      <div className="px-5 py-3.5 bg-black/10 border-t border-white/[0.04]">
        <p className="text-[11px] text-neutral-600 leading-relaxed">
          <span className="text-neutral-500 font-medium">Polling recomendado:</span> a cada 5 minutos · endpoint suporta <code className="text-[10px] bg-black/20 px-1 rounded">?limit=50</code> e <code className="text-[10px] bg-black/20 px-1 rounded">?q=busca</code>
        </p>
      </div>
    </div>
  )
}
