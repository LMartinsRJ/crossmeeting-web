import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const GRANOLA_BASE = 'https://public-api.granola.ai/v1'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('api_key, last_synced_at, synced_count')
    .eq('source', 'granola')
    .maybeSingle()

  if (!cred?.api_key) return NextResponse.json({ error: 'Granola não conectado.' }, { status: 400 })

  const headers = { Authorization: `Bearer ${cred.api_key}`, 'Content-Type': 'application/json' }
  const since = cred.last_synced_at ?? null

  // Paginar lista de notas
  const allNotes: any[] = []
  let cursor: string | null = null
  let page = 0

  while (page < 10) {
    const url = new URL(`${GRANOLA_BASE}/notes`)
    if (cursor) url.searchParams.set('cursor', cursor)
    if (since) url.searchParams.set('created_after', since)
    url.searchParams.set('page_size', '30')

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err?.message ?? 'Erro ao buscar notas do Granola.' }, { status: res.status })
    }

    const data = await res.json()
    const notes: any[] = data.notes ?? []
    allNotes.push(...notes)

    if (!data.hasMore || notes.length === 0) break
    cursor = data.cursor ?? null
    page++
  }

  let imported = 0
  for (const note of allNotes) {
    // Buscar transcrição completa da nota
    const noteRes = await fetch(`${GRANOLA_BASE}/notes/${note.id}?include=transcript`, { headers })
    if (!noteRes.ok) continue

    const full = await noteRes.json()

    // Montar transcrição como texto corrido
    const transcript = (full.transcript ?? [])
      .map((seg: any) => `${seg.source === 'microphone' ? 'Eu' : seg.source ?? 'Participante'}: ${seg.text}`)
      .join('\n')

    const summary = full.summary ?? ''
    const title = full.title || note.title || 'Reunião Granola'
    const createdAt = full.created_at ?? note.created_at ?? new Date().toISOString()
    const owner = full.owner?.name ?? full.owner?.email ?? null

    // Enhancement via Claude se tiver transcrição ou resumo
    let enhancement = null
    const content = transcript || summary
    if (content) {
      try {
        const msg = await anthropic.messages.create({
          model: process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analise esta nota de reunião do Granola e retorne um JSON com: title (string), summary (string, 2-3 frases), key_points (array de strings), action_items (array de {text, owner?}), decisions (array de strings).\n\n${transcript ? `Transcrição:\n${transcript.slice(0, 30000)}` : `Resumo:\n${summary}`}\n\nRetorne SOMENTE o JSON, sem markdown.`,
          }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        enhancement = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      } catch {}
    }

    const finalTitle = enhancement?.title ?? title

    const { error } = await supabase.from('meetings').insert({
      user_id: profile.id,
      title: finalTitle,
      created_at: createdAt,
      duration_seconds: 0,
      language: 'pt-BR',
      word_count: transcript.split(' ').filter(Boolean).length,
      transcript: transcript || null,
      enhancement: enhancement ? JSON.stringify(enhancement) : null,
      attendees: owner ? JSON.stringify([{ name: owner }]) : null,
      source: 'granola',
    })
    if (!error) imported++
  }

  const prevCount = cred?.synced_count ?? 0
  await supabase.from('integration_credentials').update({
    last_synced_at: new Date().toISOString(),
    synced_count: prevCount + imported,
    status: 'active',
  }).eq('user_id', profile.id).eq('source', 'granola')

  return NextResponse.json({ imported, total: allNotes.length })
}
