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

// Lista pastas próprias + pastas compartilhadas comigo
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  await getOrCreateDefaultSpace(service, profile.id)

  const { data: owned } = await service
    .from('spaces')
    .select('id, name, emoji, created_at, is_default')
    .eq('user_id', profile.id)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  const { data: sharedRows } = await service
    .from('space_shares')
    .select('space_id, spaces(id, name, emoji, created_at, user_id), owner_id')
    .eq('shared_with_id', profile.id)

  const ownerIds = [...new Set((sharedRows ?? []).map((r: any) => r.owner_id))]
  const { data: owners } = ownerIds.length
    ? await service.from('profiles').select('id, name, email').in('id', ownerIds)
    : { data: [] }
  const ownerMap = new Map((owners ?? []).map((o: any) => [o.id, o.name ?? o.email]))

  const shared = (sharedRows ?? [])
    .filter((r: any) => r.spaces)
    .map((r: any) => ({ ...r.spaces, ownerName: ownerMap.get(r.owner_id) ?? null }))

  return NextResponse.json({
    owned: (owned ?? []).map(s => ({ ...s, ownerName: null })),
    shared,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { name, emoji } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 })

  const { data: space, error } = await service
    .from('spaces')
    .insert({ user_id: profile.id, name: name.trim(), emoji: emoji || '📁' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(space)
}
