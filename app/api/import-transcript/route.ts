import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { title, transcript, attendees, date } = await req.json()
  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  }

  const { data: profile } = await serviceClient
    .from('profiles').select('id').eq('email', user.email).single()
  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado. Abra o app desktop primeiro.' }, { status: 404 })
  }

  // Process with Claude — includes transcript_excerpt per action item
  let enhancement: object | null = null
  let actionItems: any[] = []

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
${transcript.slice(0, 8000)}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : []
    // Remove excerpt from enhancement to keep it lean
    enhancement = {
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
      actionItems: actionItems.map(({ excerpt, ...rest }: any) => rest),
      decisions: parsed.decisions,
    }
  } catch {}

  const wordCount = transcript.trim().split(/\s+/).length
  const meetingDate = date ? new Date(date).toISOString() : new Date().toISOString()
  const attendeesJson = Array.isArray(attendees) ? attendees : []

  // Insert meeting
  const { data: meeting, error: insertError } = await serviceClient
    .from('meetings')
    .insert({
      user_id: profile.id,
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

  // Insert action items into dedicated table
  if (actionItems.length > 0) {
    await serviceClient.from('action_items').insert(
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

  // Upsert contacts
  if (attendeesJson.length > 0) {
    const now = new Date().toISOString()
    for (const a of attendeesJson) {
      if (!a.email) continue
      await serviceClient.from('contacts').upsert({
        user_id: profile.id,
        name: a.name || a.email,
        email: a.email,
        first_seen: now,
        last_seen: now,
        meeting_count: 1,
      }, { onConflict: 'user_id,email', ignoreDuplicates: false })
    }
  }

  return NextResponse.json({ id: meeting.id })
}
