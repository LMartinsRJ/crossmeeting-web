'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Attendee {
  name: string
  email: string
}

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseVTT(raw: string): string {
  const lines: string[] = []
  for (const block of raw.split(/\n\n+/)) {
    const blockLines = block.trim().split('\n')
    const textLines = blockLines.filter(
      l => !/^WEBVTT|^\d+$|-->/.test(l.trim()) && l.trim() !== ''
    )
    if (textLines.length) lines.push(textLines.join(' '))
  }
  return lines.join('\n')
}

function parseSRT(raw: string): string {
  const lines: string[] = []
  for (const block of raw.split(/\n\n+/)) {
    const blockLines = block.trim().split('\n')
    const textLines = blockLines.filter(
      l => !/^\d+$|-->/.test(l.trim()) && l.trim() !== ''
    )
    if (textLines.length) lines.push(textLines.join(' '))
  }
  return lines.join('\n')
}

function extractTranscript(filename: string, content: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'vtt') return parseVTT(content)
  if (ext === 'srt') return parseSRT(content)
  return content // .txt e outros: usa direto
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImportTranscriptModal({ defaultSpaceId, label }: { defaultSpaceId?: number; label?: string } = {}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attendeeInput, setAttendeeInput] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [transcript, setTranscript] = useState('')
  const [title, setTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function resetForm() {
    setError(null)
    setAttendeeInput('')
    setAttendees([])
    setTranscript('')
    setTitle('')
    setFileName(null)
    setDragOver(false)
  }

  function loadFile(file: File) {
    const allowed = ['txt', 'vtt', 'srt']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !allowed.includes(ext)) {
      setError('Formato não suportado. Use .txt, .vtt ou .srt.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const parsed = extractTranscript(file.name, content)
      setTranscript(parsed)
      setFileName(file.name)
      if (!title) setTitle(titleFromFilename(file.name))
      setError(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }, [title])

  function parseAttendee(raw: string): Attendee | null {
    const s = raw.trim()
    if (!s) return null
    const angleBracket = s.match(/^(.+?)\s*<([^>]+)>$/)
    if (angleBracket) return { name: angleBracket[1].trim(), email: angleBracket[2].trim() }
    if (s.includes('@')) return { name: s.split('@')[0], email: s }
    return { name: s, email: '' }
  }

  function addAttendee() {
    const a = parseAttendee(attendeeInput)
    if (a && (a.name || a.email)) {
      setAttendees(prev => [...prev, a])
      setAttendeeInput('')
    }
  }

  function removeAttendee(i: number) {
    setAttendees(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const date = (form.elements.namedItem('date') as HTMLInputElement).value

    if (!transcript.trim()) {
      setError('Adicione uma transcrição — faça upload de um arquivo ou cole o texto.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/import-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, transcript, attendees, date, spaceId: defaultSpaceId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao importar.')
      setOpen(false)
      resetForm()
      router.push(`/meetings/${json.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { resetForm(); setOpen(true) }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6C8EFF]/10 border border-[#6C8EFF]/20 text-[#6C8EFF] text-sm font-medium hover:bg-[#6C8EFF]/20 transition-colors"
      >
        <span className="text-base leading-none">↑</span>
        {label ?? 'Importar transcrição'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !loading && setOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-[#13161D] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
              <div>
                <h2 className="text-base font-semibold text-white">Importar transcrição</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Faça upload do arquivo ou cole o texto. O Claude vai gerar resumo, ações e decisões.</p>
              </div>
              <button
                onClick={() => !loading && setOpen(false)}
                className="text-neutral-600 hover:text-neutral-400 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                {/* Upload zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-[#6C8EFF]/60 bg-[#6C8EFF]/5'
                      : fileName
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.02]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.vtt,.srt"
                    className="hidden"
                    onChange={onFileInput}
                  />
                  {fileName ? (
                    <>
                      <span className="text-2xl">✓</span>
                      <p className="text-sm font-medium text-green-400">{fileName}</p>
                      <p className="text-xs text-neutral-600">Clique para trocar o arquivo</p>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl text-neutral-600">↑</span>
                      <p className="text-sm text-neutral-400">
                        Arraste o arquivo ou <span className="text-[#6C8EFF]">clique para selecionar</span>
                      </p>
                      <p className="text-xs text-neutral-700">.txt · .vtt · .srt</p>
                    </>
                  )}
                </div>

                {/* Divisor */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-xs text-neutral-700">ou cole o texto</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Textarea */}
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={7}
                  placeholder="Cole aqui o texto da transcrição..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40 transition-colors resize-none leading-relaxed"
                />

                {/* Título e Data */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Título</label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Ex: Reunião de alinhamento"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">Data</label>
                    <input
                      name="date"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#6C8EFF]/40 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Participantes */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1.5">Participantes</label>
                  <div className="flex gap-2">
                    <input
                      value={attendeeInput}
                      onChange={e => setAttendeeInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttendee() } }}
                      placeholder="nome@empresa.com ou Nome <email>"
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-700 outline-none focus:border-[#6C8EFF]/40 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={addAttendee}
                      className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-neutral-400 text-sm hover:bg-white/[0.08] transition-colors"
                    >
                      +
                    </button>
                  </div>
                  {attendees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {attendees.map((a, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-2.5 py-1 text-neutral-300">
                          {a.name || a.email}
                          <button type="button" onClick={() => removeAttendee(i)} className="text-neutral-600 hover:text-neutral-400 ml-0.5">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between shrink-0">
                <p className="text-xs text-neutral-600">O Claude vai processar e gerar resumo automaticamente.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => !loading && setOpen(false)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl bg-[#6C8EFF] text-white text-sm font-medium hover:bg-[#5a7af0] transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processando...
                      </>
                    ) : 'Importar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
