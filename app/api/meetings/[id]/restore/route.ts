import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  const { id } = await params
  // meetings_update_own policy garante que só o dono pode restaurar
  const { error } = await supabase
    .from('meetings')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
