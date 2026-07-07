import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'

const GQL = 'https://api.fireflies.ai/graphql'

async function validateFirefliesKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: '{ me { id name email } }' }),
    })
    if (!res.ok) return false
    const json = await res.json()
    return !!json?.data?.me?.id
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const { api_key } = await req.json()
  if (!api_key || typeof api_key !== 'string') {
    return NextResponse.json({ error: 'api_key obrigatória.' }, { status: 400 })
  }

  const valid = await validateFirefliesKey(api_key.trim())
  if (!valid) {
    return NextResponse.json({ error: 'API key inválida. Verifique no painel do Fireflies.' }, { status: 422 })
  }

  const { error } = await supabase.from('integration_credentials').upsert(
    { user_id: profile.id, source: 'fireflies', api_key: api_key.trim(), status: 'active', updated_at: new Date().toISOString() },
    { onConflict: 'user_id,source' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  await supabase.from('integration_credentials')
    .delete()
    .eq('user_id', profile.id)
    .eq('source', 'fireflies')

  return NextResponse.json({ ok: true })
}
