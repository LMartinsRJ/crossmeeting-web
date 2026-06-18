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
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { title, transcript, attendees, date } = await req.json()
  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 400 })
  }

  // Get profile UUID
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado. Abra o app desktop primeiro.' }, { status: 404 })
  }

  // Process with Claude
  let enhancement: object | null = null
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analise a transcrição de reunião abaixo e retorne um JSON com exatamente estas chaves:
- "summary": string com resumo em 2-4 frases
- "keyPoints": array de strings com 3-6 pontos principais discutidos
- "actionItems": array de objetos {text: string, owner?: string, due?: string} com ações a fazer
- "decisions": array de objetos {text: string} com decisões tomadas

Responda APENAS com o JSON, sem markdown, sem explicações.

TRANSCRIÇÃO:
${transcript.slice(0, 8000)}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    enhancement = JSON.parse(cleaned)
  } catch (e) {
    // Continue without enhancement if Claude fails
  }

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
