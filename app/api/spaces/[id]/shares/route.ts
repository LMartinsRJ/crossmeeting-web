import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getOwnedSpace(service: ReturnType<typeof getService>, spaceId: string, ownerId: string) {
  const { data } = await service.from('spaces').select('id, user_id').eq('id', spaceId).eq('user_id', ownerId).single()
  return data
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const space = await getOwnedSpace(service, id, profile.id)
  if (!space) return NextResponse.json({ error: 'Pasta não encontrada ou você não é o dono.' }, { status: 404 })

  const { data: shares } = await service
    .from('space_shares')
    .select('id, shared_with_email, shared_with_id, created_at')
    .eq('space_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json(shares ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const space = await getOwnedSpace(service, id, profile.id)
  if (!space) return NextResponse.json({ error: 'Pasta não encontrada ou você não é o dono.' }, { status: 404 })

  const { email } = await req.json()
  const normalizedEmail = (email ?? '').trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }
  if (normalizedEmail === user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Você já tem acesso a esta pasta.' }, { status: 400 })
  }

  const { data: targetProfile } = await service
    .from('profiles').select('id').eq('email', normalizedEmail).single()

  const { data: share, error } = await service
    .from('space_shares')
    .upsert({
      space_id: id,
      owner_id: profile.id,
      shared_with_email: normalizedEmail,
      shared_with_id: targetProfile?.id ?? null,
    }, { onConflict: 'space_id,shared_with_email' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(share)
}
