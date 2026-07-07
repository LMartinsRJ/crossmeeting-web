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
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', profile.id) // RLS extra: só revoga a própria chave

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
