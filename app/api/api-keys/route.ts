import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'
import { createHash, randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string | undefined)?.trim() || 'Chave da web'

  // Gera token legível: crossmeeting_<32 bytes hex>
  const raw = `crossmeeting_${randomBytes(32).toString('hex')}`
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 28) + '...' // exibe só o início

  const { error } = await supabase.from('api_keys').insert({
    user_id: profile.id,
    name,
    key_hash: hash,
    key_prefix: prefix,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Retorna a chave completa UMA ÚNICA VEZ — não é armazenada em texto plano
  return NextResponse.json({ key: raw, prefix })
}
