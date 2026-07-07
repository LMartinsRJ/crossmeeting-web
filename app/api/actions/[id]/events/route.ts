import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, notFound } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  const { id } = await params
  // action_item_events_own policy filtra por ações do usuário
  const { data } = await supabase
    .from('action_item_events')
    .select('*')
    .eq('action_item_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado.')

  const { id } = await params
  const { comment } = await req.json()

  const { data: profileFull } = await supabase.from('profiles').select('id, name').maybeSingle()

  const { data, error } = await supabase.from('action_item_events').insert({
    action_item_id: Number(id),
    user_id: profile.id,
    user_name: profileFull?.name ?? user.email,
    type: 'comment',
    comment,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
