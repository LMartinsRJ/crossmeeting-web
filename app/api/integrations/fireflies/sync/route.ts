import { NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const GQL = 'https://api.fireflies.ai/graphql'

async function fetchTranscripts(apiKey: string, fromDate?: string) {
  const query = `
    query Transcripts($fromDate: String) {
      transcripts(fromDate: $fromDate, limit: 50) {
        id
        title
        date
        duration
        sentences { text speaker_name }
        summary { overview action_items keywords }
        participants
      }
    }
  `
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables: { fromDate } }),
  })
  if (!res.ok) throw new Error(`Fireflies API error: ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return (json.data?.transcripts ?? []) as any[]
}

async function enhance(transcript: string, attendees: string[]): Promise<string | null> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const model = process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6'
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analise a transcrição a seguir e retorne um JSON com esta estrutura exata (sem markdown, só o JSON):
{"title":"<título curto>","summary":"<resumo em 2-3 frases>","keyPoints":["..."],"actionItems":[{"text":"...","owner":"...","due":"..."}],"decisions":[{"text":"..."}]}

Participantes: ${attendees.join(', ') || 'desconhecidos'}
Transcrição:
${transcript.slice(0, 12000)}`,
      }],
    })
    const text = (msg.content[0] as any).text?.trim() ?? ''
    JSON.parse(text) // validate
    return text
  } catch {
    return null
  }
}

export async function POST() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('api_key, last_synced_at')
    .eq('user_id', profile.id)
    .eq('source', 'fireflies')
    .eq('status', 'active')
    .maybeSingle()

  if (!cred) {
    return NextResponse.json({ error: 'Fireflies não conectado.' }, { status: 400 })
  }

  let transcripts: any[]
  try {
    const fromDate = cred.last_synced_at
      ? new Date(cred.last_synced_at).toISOString().split('T')[0]
      : undefined
    transcripts = await fetchTranscripts(cred.api_key, fromDate)
  } catch (e: any) {
    await supabase.from('integration_credentials')
      .update({ status: 'error', error_message: e.message, updated_at: new Date().toISOString() })
      .eq('user_id', profile.id).eq('source', 'fireflies')
    return NextResponse.json({ error: e.message }, { status: 502 })
  }

  let imported = 0
  for (const t of transcripts) {
    // Build transcript text from sentences
    const transcriptText = (t.sentences ?? [])
      .map((s: any) => (s.speaker_name ? `${s.speaker_name}: ${s.text}` : s.text))
      .join('\n')

    const participants: string[] = t.participants ?? []
    const attendeesJson = JSON.stringify(participants.map((name: string) => ({ name, email: null })))

    const durationSecs = Math.round((t.duration ?? 0) * 60)
    const wordCount = transcriptText.split(/\s+/).filter(Boolean).length

    const enhancement = await enhance(transcriptText, participants)

    let title = t.title || 'Reunião importada'
    if (enhancement) {
      try { title = JSON.parse(enhancement).title ?? title } catch { /* keep original */ }
    }

    const createdAt = t.date ? new Date(t.date).toISOString() : new Date().toISOString()

    const { error } = await supabase.from('meetings').insert({
      user_id: profile.id,
      title,
      transcript: transcriptText,
      enhancement,
      attendees: attendeesJson,
      duration_seconds: durationSecs,
      word_count: wordCount,
      language: 'pt-BR',
      created_at: createdAt,
    })

    if (!error) imported++
  }

  const now = new Date().toISOString()
  await supabase.from('integration_credentials').update({
    last_synced_at: now,
    synced_count: (cred as any).synced_count + imported,
    status: 'active',
    error_message: null,
    updated_at: now,
  }).eq('user_id', profile.id).eq('source', 'fireflies')

  return NextResponse.json({ ok: true, imported, total: transcripts.length })
}
