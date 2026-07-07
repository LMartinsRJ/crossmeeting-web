import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function POST(req: Request) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { account_id, client_id, client_secret } = await req.json()
  if (!account_id || !client_id || !client_secret) {
    return NextResponse.json({ error: 'account_id, client_id e client_secret são obrigatórios.' }, { status: 400 })
  }

  // Validar credenciais obtendo um token
  const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')
  const tokenRes = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(account_id)}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
  )

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    return NextResponse.json({ error: err?.reason ?? 'Credenciais Zoom inválidas.' }, { status: 400 })
  }

  // Salvar credenciais como JSON em api_key (reutilizando campo)
  const credentials = JSON.stringify({ account_id, client_id, client_secret })

  const { error } = await supabase.from('integration_credentials').upsert({
    user_id: profile.id,
    source: 'zoom',
    api_key: credentials,
    status: 'active',
  }, { onConflict: 'user_id,source' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  await supabase.from('integration_credentials').delete().eq('user_id', profile.id).eq('source', 'zoom')
  return NextResponse.json({ ok: true })
}
