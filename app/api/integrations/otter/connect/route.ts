import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

export async function POST(req: Request) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { api_key } = await req.json()
  if (!api_key?.trim()) return NextResponse.json({ error: 'api_key é obrigatório.' }, { status: 400 })

  // Otter não tem endpoint de validação pública — salva diretamente
  const { error } = await supabase.from('integration_credentials').upsert({
    user_id: profile.id,
    source: 'otter',
    api_key: api_key.trim(),
    status: 'active',
  }, { onConflict: 'user_id,source' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  await supabase.from('integration_credentials').delete().eq('user_id', profile.id).eq('source', 'otter')
  return NextResponse.json({ ok: true })
}
