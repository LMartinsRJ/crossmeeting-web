import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  const { id } = await params
  const { title } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Título não pode ser vazio.' }, { status: 400 })

  // meetings_update_own policy garante que só o dono pode renomear
  const { error } = await supabase.from('meetings').update({ title: title.trim() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
