import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

const GRANOLA_BASE = 'https://public-api.granola.ai/v1'

export async function POST(req: Request) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { api_key } = await req.json()
  if (!api_key?.trim()) return NextResponse.json({ error: 'api_key é obrigatório.' }, { status: 400 })

  // Validar a chave listando uma nota
  const res = await fetch(`${GRANOLA_BASE}/notes?cursor=&page_size=1`, {
    headers: { Authorization: `Bearer ${api_key.trim()}`, 'Content-Type': 'application/json' },
  })

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json({ error: 'Chave inválida ou sem permissão. Verifique a chave em Granola → Settings → Connectors → API keys.' }, { status: 400 })
  }
  if (!res.ok) {
    return NextResponse.json({ error: 'Não foi possível validar a chave Granola. Tente novamente.' }, { status: 400 })
  }

  const { error } = await supabase.from('integration_credentials').upsert({
    user_id: profile.id,
    source: 'granola',
    api_key: api_key.trim(),
    status: 'active',
  }, { onConflict: 'user_id,source' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  await supabase.from('integration_credentials').delete().eq('user_id', profile.id).eq('source', 'granola')
  return NextResponse.json({ ok: true })
}
