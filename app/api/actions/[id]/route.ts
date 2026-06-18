import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getProfileId(email: string) {
  const { data } = await service.from('profiles').select('id, name').eq('email', email).single()
  return data
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const profile = await getProfileId(user.email)
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const body = await req.json()
  const { _event_type, _event_field, _event_old, _event_new, _comment, ...fields } = body

  // Update action
  const { data: updated, error } = await service
    .from('action_items')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log event
  if (_event_type) {
    await service.from('action_item_events').insert({
      action_item_id: Number(id),
      user_id: profile.id,
      user_name: profile.name ?? user.email,
      type: _event_type,
      field: _event_field ?? null,
      old_value: _event_old ?? null,
      new_value: _event_new ?? null,
      comment: _comment ?? null,
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const profile = await getProfileId(user.email)
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const { error } = await service
    .from('action_items')
    .delete()
    .eq('id', id)
    .eq('user_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
