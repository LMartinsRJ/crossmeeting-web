import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'

export async function GET() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, name, url, events, status, last_triggered_at, error_count, last_error, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhooks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const body = await req.json()
  const { name, url, events, secret } = body

  if (!name?.trim() || !url?.trim() || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'name, url e pelo menos um evento são obrigatórios.' }, { status: 400 })
  }

  try { new URL(url) } catch {
    return NextResponse.json({ error: 'URL inválida.' }, { status: 400 })
  }

  const validEvents = ['action_done', 'briefing_ready']
  const invalidEvents = events.filter((e: string) => !validEvents.includes(e))
  if (invalidEvents.length > 0) {
    return NextResponse.json({ error: `Eventos inválidos: ${invalidEvents.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ user_id: profile.id, name: name.trim(), url: url.trim(), events, secret: secret?.trim() || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
