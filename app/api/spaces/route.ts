import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, notFound } from '@/lib/auth'
import { getOrCreateDefaultSpace } from '@/lib/spaces'

// Lista pastas próprias + pastas compartilhadas comigo
export async function GET() {
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado.')

  await getOrCreateDefaultSpace(supabase, profile.id)

  const { data: owned } = await supabase
    .from('spaces')
    .select('id, name, emoji, created_at, is_default')
    .eq('user_id', profile.id)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  const { data: sharedRows } = await supabase
    .from('space_shares')
    .select('space_id, spaces(id, name, emoji, created_at, user_id), owner_id')
    .eq('shared_with_id', profile.id)

  const ownerIds = [...new Set((sharedRows ?? []).map((r: any) => r.owner_id))]
  const { data: owners } = ownerIds.length
    ? await supabase.from('profiles').select('id, name, email').in('id', ownerIds)
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
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado.')

  const { name, emoji } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 })

  // spaces_insert_own policy: WITH CHECK (user_id = auth_profile_id())
  const { data: space, error } = await supabase
    .from('spaces')
    .insert({ user_id: profile.id, name: name.trim(), emoji: emoji || '📁' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(space)
}
