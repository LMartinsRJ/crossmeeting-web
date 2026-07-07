import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext, unauthorized, notFound } from '@/lib/auth'
import { getOrCreateDefaultSpace } from '@/lib/spaces'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hora

// Rate limit persistente via Supabase — user_id = auth.uid() com RLS
async function checkRateLimit(supabase: any, userId: string): Promise<boolean> {
  const now = new Date()
  const { data } = await supabase
    .from('import_rate_limits')
    .select('count, reset_at')
    .eq('user_id', userId)
    .single()

  if (!data || new Date(data.reset_at) < now) {
    await supabase.from('import_rate_limits').upsert({
      user_id: userId,
      count: 1,
      reset_at: new Date(now.getTime() + RATE_WINDOW_MS).toISOString(),
    }, { onConflict: 'user_id' })
    return true
  }
  if (data.count >= RATE_LIMIT) return false
  await supabase.from('import_rate_limits').update({ count: data.count + 1 }).eq('user_id', userId)
  return true
}

export async function POST(req: NextRequest) {
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado. Abra o app desktop primeiro.')

  if (!await checkRateLimit(supabase, user.id)) {
    return NextResponse.json(
      { error: 'Limite de importações atingido. Tente novamente em uma hora.' },
      { status: 429 }
    )
  }

  const { title, transcript, attendees, date, spaceId } = await req.json()
  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  }

  // Valida pasta — RLS filtra espaços visíveis (próprios ou compartilhados)
  let validSpaceId: number | null = null
  if (spaceId) {
    const { data: space } = await supabase.from('spaces').select('id').eq('id', spaceId).single()
    if (space) validSpaceId = space.id
  }

  if (!validSpaceId) {
    const defaultSpace = await getOrCreateDefaultSpace(supabase, profile.id)
    validSpaceId = defaultSpace.id
  }

  let enhancement: object | null = null
  let actionItems: any[] = []
  let enhancementFailed = false

  // Haiku tem 200k tokens de contexto; 80k chars ≈ 20k tokens
  const transcriptForClaude = transcript.slice(0, 80_000)

  try {
    const message = await getAnthropic().messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analise esta transcrição de reunião e retorne um JSON com exatamente estas chaves:
- "summary": string com resumo em 2-4 frases
- "keyPoints": array de strings com 3-6 pontos principais
- "actionItems": array de objetos com campos:
    text (string), owner (string ou null), due (string ou null),
    excerpt (string: trecho EXATO e curto da transcrição que originou esta ação, máx 150 chars)
- "decisions": array de objetos {text: string}

Responda APENAS com o JSON, sem markdown.

TRANSCRIÇÃO:
${transcriptForClaude}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : []
    enhancement = {
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
      actionItems: actionItems.map(({ excerpt, ...rest }: any) => rest),
      decisions: parsed.decisions,
    }
  } catch (err) {
    console.error('[import-transcript] Claude falhou:', err)
    enhancementFailed = true
  }

  const wordCount = transcript.trim().split(/\s+/).length
  const meetingDate = date ? new Date(date).toISOString() : new Date().toISOString()
  const attendeesJson = Array.isArray(attendees) ? attendees : []

  // meetings_insert_own WITH CHECK (user_id = auth_profile_id())
  const { data: meeting, error: insertError } = await supabase
    .from('meetings')
    .insert({
      user_id: profile.id,
      space_id: validSpaceId,
      title: title?.trim() || 'Reunião importada',
      created_at: meetingDate,
      duration_seconds: 0,
      word_count: wordCount,
      transcript,
      enhancement: enhancement ? JSON.stringify(enhancement) : null,
      attendees: attendeesJson.length > 0 ? attendeesJson : null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (actionItems.length > 0) {
    await supabase.from('action_items').insert(
      actionItems.map((a: any) => ({
        user_id: profile.id,
        meeting_id: meeting.id,
        meeting_title: title?.trim() || 'Reunião importada',
        text: a.text,
        owner: a.owner ?? null,
        tipo: 'acao',
        prioridade: 'media',
        status: 'pendente',
        transcript_excerpt: a.excerpt ?? null,
        created_at: meetingDate,
        updated_at: new Date().toISOString(),
      }))
    )
  }

  if (attendeesJson.length > 0) {
    const now = new Date().toISOString()
    for (const a of attendeesJson) {
      if (!a.email) continue
      // contacts_insert_own / contacts_update_own policies
      await supabase.from('contacts').upsert({
        user_id: profile.id,
        name: a.name || a.email,
        email: a.email,
        first_seen: now,
        last_seen: now,
        meeting_count: 1,
      }, { onConflict: 'user_id,email', ignoreDuplicates: false })
    }
  }

  return NextResponse.json({
    id: meeting.id,
    ...(enhancementFailed && { warning: 'A análise com IA falhou. A transcrição foi salva, mas o resumo e as ações não foram gerados.' }),
  })
}
