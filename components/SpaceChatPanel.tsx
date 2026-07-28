'use client'

import { useState, useRef, useEffect } from 'react'

const RECIPES = [
  { id: 'prepare', label: '📋 Preparar reunião', prompt: 'Com base nas reuniões desta pasta, me ajude a preparar a próxima. Quais pontos, pendências e contextos devo lembrar?' },
  { id: 'actions', label: '✅ Pendências abertas', prompt: 'Liste todas as pendências (action items) abertas das reuniões desta pasta, agrupadas por reunião.' },
  { id: 'recap', label: '🗓️ Recap geral', prompt: 'Faça um resumo geral de todas as reuniões desta pasta, destacando principais temas e decisões.' },
  { id: 'short', label: '✂️ Resumo curto', prompt: 'Resuma as reuniões desta pasta em até 5 frases, focando apenas no que foi decidido.' },
]

type Message = { role: 'user' | 'assistant'; content: string }

export default function SpaceChatPanel({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  async function send(question: string) {
    const q = question.trim()
    if (!q || loading) return
    setInput('')
    setError(null)
    const newHistory: Message[] = [...history, { role: 'user', content: q }]
    setHistory(newHistory)
    setLoading(true)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')
      setHistory([...newHistory, { role: 'assistant', content: data.answer }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar IA.')
      setHistory(history) // reverte
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  return (
    <div className="mt-8 border-t border-white/[0.06] pt-6">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors mb-4"
      >
        <span className="text-base">✨</span>
        Perguntar à IA sobre esta pasta
        <span className="ml-auto text-neutral-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          {/* Recipe chips */}
          {history.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {RECIPES.map(r => (
                <button
                  key={r.id}
                  onClick={() => send(r.prompt)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] text-xs text-neutral-300 transition-colors disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* Histórico */}
          {history.length > 0 && (
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
              {history.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white/[0.06] text-neutral-200 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Input */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte sobre as reuniões desta pasta..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-blue-500 resize-none transition-colors disabled:opacity-50"
              style={{ minHeight: '42px', maxHeight: '120px' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              ↑
            </button>
          </div>

          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-xs text-neutral-700 hover:text-neutral-500 text-right transition-colors">
              Limpar conversa
            </button>
          )}
        </div>
      )}
    </div>
  )
}
