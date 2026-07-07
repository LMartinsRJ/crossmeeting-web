import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const OTTER_BASE = 'https://api.otter.ai/v1'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('api_key, last_synced_at, synced_count')
    .eq('source', 'otter')
    .maybeSingle()

  if (!cred?.api_key) return NextResponse.json({ error: 'Otter.ai não conectado.' }, { status: 400 })

  const headers = {
    Authorization: `Bearer ${cred.api_key}`,
    'Content-Type': 'application/json',
  }

  // 1. Buscar workspaces do usuário
  const wsRes = await fetch(`${OTTER_BASE}/workspaces`, { headers })

  if (wsRes.status === 401 || wsRes.status === 403) {
    return NextResponse.json({
      error: 'Chave inválida ou sem permissão. A API da Otter.ai requer plano Enterprise. Verifique sua chave em Otter → Integrations → Developer.',
    }, { status: 401 })
  }
  if (!wsRes.ok) {
    const err = await wsRes.json().catch(() => ({}))
    return NextResponse.json({ error: err?.message ?? 'Erro ao acessar Otter.ai API.' }, { status: wsRes.status })
  }

  const wsData = await wsRes.json()
  const workspaces: any[] = wsData.workspaces ?? wsData.data ?? [wsData]
  if (!workspaces.length) return NextResponse.json({ imported: 0, total: 0 })

  const since = cred.last_synced_at ?? null
  const allConversations: any[] = []

  // 2. Para cada workspace, listar conversas
  for (const ws of workspaces) {
    const wsId = ws.id ?? ws.workspace_id
    if (!wsId) continue

    let cursor: string | null = null
    let page = 0

    while (page < 10) {
      const url = new URL(`${OTTER_BASE}/workspace/${wsId}/conversations`)
      url.searchParams.set('limit', '30')
      if (cursor) url.searchParams.set('cursor', cursor)

      const convRes = await fetch(url.toString(), { headers })
      if (!convRes.ok) break

      const convData = await convRes.json()
      const conversations: any[] = convData.conversations ?? convData.data ?? []

      // Filtrar pelo cursor de data
      const filtered = since
        ? conversations.filter((c: any) => {
            const ts = c.created_at ?? c.start_time ?? c.date
            return ts && new Date(ts) > new Date(since)
          })
        : conversations

      allConversations.push(...filtered)

      // Se filtramos algum e eram menos que o limit, paramos (já chegamos no ponto de corte)
      if (since && filtered.length < conversations.length) break
      if (!convData.next_cursor && !convData.cursor) break

      cursor = convData.next_cursor ?? convData.cursor
      page++
    }
  }

  // 3. Para cada conversa, buscar transcrição completa
  let imported = 0
  for (const conv of allConversations) {
    const convId = conv.id ?? conv.conversation_id
    if (!convId) continue

    const detailRes = await fetch(
      `${OTTER_BASE}/conversations/${convId}?include=transcript,action_items`,
      { headers }
    )
    if (!detailRes.ok) continue

    const detail = await detailRes.json()
    const conversation = detail.conversation ?? detail

    // Montar texto da transcrição a partir de utterances
    const utterances: any[] = conversation.transcript?.utterances ?? conversation.utterances ?? []
    const transcript = utterances
      .map((u: any) => {
        const speaker = u.speaker_name ?? u.speaker ?? 'Participante'
        const text = u.text ?? u.transcript ?? ''
        return `${speaker}: ${text}`
      })
      .filter((l: string) => l.length > 10)
      .join('\n')

    const title = conversation.title ?? conv.title ?? 'Reunião Otter.ai'
    const startTs = conversation.created_at ?? conversation.start_time ?? conv.created_at ?? new Date().toISOString()
    const durationSeconds = conversation.audio_size
      ? 0
      : Math.round((conversation.end_time - conversation.start_time) / 1000) || 0

    const attendees = (conversation.speakers ?? []).map((s: any) => ({
      name: s.name ?? s.speaker_name ?? 'Participante',
    }))

    let enhancement = null
    const content = transcript || (conversation.summary ?? '')
    if (content) {
      try {
        const msg = await anthropic.messages.create({
          model: process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analise esta transcrição de reunião do Otter.ai e retorne um JSON com: title (string), summary (string, 2-3 frases), key_points (array de strings), action_items (array de {text, owner?}), decisions (array de strings).\n\n${transcript ? `Transcrição:\n${transcript.slice(0, 30000)}` : `Resumo:\n${content}`}\n\nRetorne SOMENTE o JSON, sem markdown.`,
          }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        enhancement = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      } catch {}
    }

    const { error } = await supabase.from('meetings').insert({
      user_id: profile.id,
      title: enhancement?.title ?? title,
      created_at: startTs,
      duration_seconds: durationSeconds,
      language: 'pt-BR',
      word_count: transcript.split(' ').filter(Boolean).length,
      transcript: transcript || null,
      enhancement: enhancement ? JSON.stringify(enhancement) : null,
      attendees: attendees.length > 0 ? JSON.stringify(attendees) : null,
      source: 'otter',
    })
    if (!error) imported++
  }

  const prevCount = cred?.synced_count ?? 0
  await supabase.from('integration_credentials').update({
    last_synced_at: new Date().toISOString(),
    synced_count: prevCount + imported,
    status: 'active',
  }).eq('user_id', profile.id).eq('source', 'otter')

  return NextResponse.json({ imported, total: allConversations.length })
}
