import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, notFound } from '@/lib/auth'
import { fireWebhooks } from '@/lib/webhooks'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado.')

  const { id } = await params
  const body = await req.json()
  const { _event_type, _event_field, _event_old, _event_new, _comment, ...fields } = body

  // action_items_own policy garante que só o dono pode atualizar
  const { data: updated, error } = await supabase
    .from('action_items')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dispara webhook quando ação é concluída
  if (fields.status === 'done' && profile) {
    fireWebhooks(supabase, profile.id, 'action_done', {
      id: updated.id,
      text: updated.text,
      owner: updated.owner ?? null,
      due_date: updated.due_date ?? null,
      meeting_id: updated.meeting_id ?? null,
      completed_at: new Date().toISOString(),
    }).catch(() => {}) // fire-and-forget, não bloqueia resposta
  }

  if (_event_type) {
    const { data: profileFull } = await supabase.from('profiles').select('id, name').maybeSingle()
    await supabase.from('action_item_events').insert({
      action_item_id: Number(id),
      user_id: profile.id,
      user_name: profileFull?.name ?? user.email,
      type: _event_type,
      field: _event_field ?? null,
      old_value: _event_old ?? null,
      new_value: _event_new ?? null,
      comment: _comment ?? null,
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  const { id } = await params
  // action_items_own policy garante que só o dono pode deletar
  const { error } = await supabase.from('action_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
