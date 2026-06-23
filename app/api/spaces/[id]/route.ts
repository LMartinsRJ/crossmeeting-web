import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getOrCreateDefaultSpace } from '@/lib/spaces'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getProfileAndAccess(service: ReturnType<typeof getService>, email: string, spaceId: string) {
  const { data: profile } = await service.from('profiles').select('id').eq('email', email).single()
  if (!profile) return { profile: null, space: null, isOwner: false, isMember: false }

  const { data: space } = await service.from('spaces').select('*').eq('id', spaceId).single()
  if (!space) return { profile, space: null, isOwner: false, isMember: false }

  const isOwner = space.user_id === profile.id
  let isMember = false
  if (!isOwner) {
    const { data: share } = await service
      .from('space_shares').select('id').eq('space_id', spaceId).eq('shared_with_id', profile.id).single()
    isMember = !!share
  }
  return { profile, space, isOwner, isMember }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { id } = await params
  const { space, isOwner, isMember } = await getProfileAndAccess(service, user.email, id)
  if (!space || (!isOwner && !isMember)) {
    return NextResponse.json({ error: 'Pasta não encontrada ou sem acesso.' }, { status: 404 })
  }

  const { data: meetings } = await service
    .from('meetings')
    .select('id, title, created_at, duration_seconds, enhancement, attendees, user_id')
    .eq('space_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ space, isOwner, meetings: meetings ?? [] })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { id } = await params
  const { space, isOwner } = await getProfileAndAccess(service, user.email, id)
  if (!space || !isOwner) {
    return NextResponse.json({ error: 'Pasta não encontrada ou você não é o dono.' }, { status: 404 })
  }
  if (space.is_default) {
    return NextResponse.json({ error: 'O space padrão não pode ser excluído.' }, { status: 400 })
  }

  // Reuniões do space excluído voltam para o space padrão (toda reunião sempre tem um space)
  const defaultSpace = await getOrCreateDefaultSpace(service, space.user_id)
  const { error: unlinkError } = await service.from('meetings').update({ space_id: defaultSpace.id }).eq('space_id', id)
  if (unlinkError) return NextResponse.json({ error: unlinkError.message }, { status: 500 })

  const { error } = await service.from('spaces').delete().eq('id', id).eq('user_id', space.user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
