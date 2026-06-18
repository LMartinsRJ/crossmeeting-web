import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const { data } = await getService()
    .from('action_item_events')
    .select('*')
    .eq('action_item_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await getService()
    .from('profiles').select('id, name').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const { comment } = await req.json()

  const { data, error } = await getService().from('action_item_events').insert({
    action_item_id: Number(id),
    user_id: profile.id,
    user_name: profile.name ?? user.email,
    type: 'comment',
    comment,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
