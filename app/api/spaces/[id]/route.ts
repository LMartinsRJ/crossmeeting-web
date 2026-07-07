import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, notFound } from '@/lib/auth'
import { getOrCreateDefaultSpace } from '@/lib/spaces'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  const { id } = await params
  // spaces RLS: SELECT own + shared — se não existir, retorna null
  const { data: space } = await supabase.from('spaces').select('*').eq('id', id).single()
  if (!space) return notFound('Pasta não encontrada ou sem acesso.')

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, created_at, duration_seconds, enhancement, attendees, user_id')
    .eq('space_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ space, meetings: meetings ?? [] })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado.')

  const { id } = await params
  const { data: space } = await supabase.from('spaces').select('*').eq('id', id).eq('user_id', profile.id).single()
  if (!space) return notFound('Pasta não encontrada ou você não é o dono.')
  if (space.is_default) return NextResponse.json({ error: 'O space padrão não pode ser excluído.' }, { status: 400 })

  // Reuniões do space excluído voltam para o space padrão
  const defaultSpace = await getOrCreateDefaultSpace(supabase, profile.id)
  const { error: unlinkError } = await supabase.from('meetings').update({ space_id: defaultSpace.id }).eq('space_id', id)
  if (unlinkError) return NextResponse.json({ error: unlinkError.message }, { status: 500 })

  // spaces_delete_own policy garante que só o dono pode deletar
  const { error } = await supabase.from('spaces').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
