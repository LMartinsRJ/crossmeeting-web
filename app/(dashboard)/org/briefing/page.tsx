'use client'

import { useEffect, useState } from 'react'

interface BriefingStats {
  totalMembers: number
  openActions: number
  overdueActions: number
  doneLastWeek: number
  meetingsLastWeek: number
}

interface Briefing {
  content: string
  stats: BriefingStats
  created_at: string
  date: string
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const level = line.startsWith('### ') ? 3 : 2
      const content = line.replace(/^#{2,3} /, '').replace(/\*\*(.*?)\*\*/g, '$1')
      elements.push(
        <h2 key={i} className={`font-semibold text-white mt-5 mb-2 ${level === 3 ? 'text-sm' : 'text-[15px]'}`}>
          {content}
        </h2>
      )
    } else if (line.startsWith('**') && line.endsWith('**')) {
      const content = line.replace(/\*\*/g, '')
      elements.push(<h2 key={i} className="font-semibold text-white mt-5 mb-2 text-[15px]">{content}</h2>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      elements.push(
        <li key={i} className="text-sm text-neutral-300 ml-4 mb-1 list-disc"
          dangerouslySetInnerHTML={{ __html: content }} />
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)
    } else {
      const content = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      elements.push(
        <p key={i} className="text-sm text-neutral-300 mb-1 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }} />
      )
    }
  }
  return <div>{elements}</div>
}

export default function OrgBriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/org/briefing?date=${today}`)
    if (res.ok) {
      const d = await res.json()
      setBriefing(d.briefing)
    }
    setLoading(false)
  }

  async function generate() {
    setGenerating(true)
    setError(null)
    const res = await fetch('/api/org/briefing', { method: 'POST' })
    if (res.ok) {
      await load()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Erro ao gerar')
    }
    setGenerating(false)
  }

  useEffect(() => { load() }, [])

  const statsItems = briefing?.stats ? [
    { label: 'Membros',         value: briefing.stats.totalMembers,    color: 'text-blue-400'   },
    { label: 'Ações abertas',   value: briefing.stats.openActions,     color: 'text-yellow-400' },
    { label: 'Vencidas',        value: briefing.stats.overdueActions,  color: 'text-red-400'    },
    { label: 'Concluídas (7d)', value: briefing.stats.doneLastWeek,    color: 'text-green-400'  },
    { label: 'Reuniões (7d)',   value: briefing.stats.meetingsLastWeek,color: 'text-neutral-400'},
  ] : []

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">📋</span>
            <h1 className="text-xl font-semibold text-white">Briefing Executivo</h1>
            <span className="text-[10px] bg-[#6C8EFF]/20 text-[#6C8EFF] px-2 py-0.5 rounded-full font-semibold">IA</span>
          </div>
          <p className="text-sm text-neutral-500">
            {new Date(today + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="px-4 py-2 bg-[#6C8EFF] hover:bg-[#5a7ef0] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          {generating ? 'Gerando…' : briefing ? '↻ Regenerar' : '✦ Gerar briefing'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-10 text-center text-neutral-600 text-sm">
          Carregando briefing…
        </div>
      )}

      {!loading && !briefing && !generating && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-10 text-center space-y-4">
          <div className="text-4xl">📋</div>
          <div>
            <h2 className="text-white font-semibold mb-1">Nenhum briefing para hoje</h2>
            <p className="text-neutral-500 text-sm">
              O briefing é gerado automaticamente às 08:00 todos os dias.
              <br />Clique em "Gerar briefing" para criar agora.
            </p>
          </div>
        </div>
      )}

      {generating && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-10 text-center space-y-3">
          <div className="text-3xl animate-pulse">✦</div>
          <p className="text-neutral-500 text-sm">Claude está analisando a organização…</p>
        </div>
      )}

      {briefing && !generating && (
        <>
          {/* Stats snapshot */}
          <div className="grid grid-cols-5 gap-3">
            {statsItems.map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-neutral-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Briefing content */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
            <MarkdownBlock text={briefing.content} />
          </div>

          <p className="text-xs text-neutral-700 text-center">
            Gerado às {new Date(briefing.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {' '}· por Claude Haiku
          </p>
        </>
      )}
    </div>
  )
}
