import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const { id } = await params
  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('user_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // POST /api/webhooks/[id]/test — envia payload de teste
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const { id } = await params
  const { data: wh } = await supabase
    .from('webhook_endpoints')
    .select('url, secret')
    .eq('id', id)
    .eq('user_id', profile.id)
    .single()

  if (!wh) return NextResponse.json({ error: 'Webhook não encontrado.' }, { status: 404 })

  const payload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'Teste de webhook do Crossmeeting.' },
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Crossmeeting-Webhooks/1.0' }
  if (wh.secret) {
    const { createHmac } = await import('crypto')
    const sig = createHmac('sha256', wh.secret).update(JSON.stringify(payload)).digest('hex')
    headers['X-Crossmeeting-Signature'] = `sha256=${sig}`
  }

  try {
    const res = await fetch(wh.url, { method: 'POST', headers, body: JSON.stringify(payload) })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 })
  }
}
