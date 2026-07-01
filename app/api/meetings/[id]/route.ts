import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Move uma reunião para uma pasta (ou remove da pasta com spaceId: null)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const { data: meeting } = await service.from('meetings').select('id, user_id').eq('id', id).eq('user_id', profile.id).single()
  if (!meeting) return NextResponse.json({ error: 'Reunião não encontrada ou você não é o dono.' }, { status: 404 })

  const { spaceId } = await req.json()

  let validSpaceId: number | null = null
  if (spaceId) {
    const { data: space } = await service.from('spaces').select('id, user_id').eq('id', spaceId).single()
    if (!space) return NextResponse.json({ error: 'Pasta não encontrada.' }, { status: 404 })
    const isOwner = space.user_id === profile.id
    let isMember = false
    if (!isOwner) {
      const { data: share } = await service
        .from('space_shares').select('id').eq('space_id', spaceId).eq('shared_with_id', profile.id).single()
      isMember = !!share
    }
    if (!isOwner && !isMember) return NextResponse.json({ error: 'Sem acesso a esta pasta.' }, { status: 403 })
    validSpaceId = space.id
  }

  const { error } = await service.from('meetings').update({ space_id: validSpaceId }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, spaceId: validSpaceId })
}

// Soft-delete: move para lixeira (deleted_at = now)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const { data: meeting } = await service.from('meetings').select('id, user_id').eq('id', id).eq('user_id', profile.id).single()
  if (!meeting) return NextResponse.json({ error: 'Reunião não encontrada ou você não é o dono.' }, { status: 404 })

  const { error } = await service.from('meetings').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/briefing')
  revalidatePath('/meetings')
  return NextResponse.json({ ok: true })
}
