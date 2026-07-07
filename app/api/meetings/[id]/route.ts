import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAuthContext, unauthorized, notFound } from '@/lib/auth'

// Move uma reunião para uma pasta (ou remove da pasta com spaceId: null)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, profile } = await getAuthContext()
  if (!user) return unauthorized()
  if (!profile) return notFound('Perfil não encontrado.')

  const { id } = await params
  const { spaceId } = await req.json()

  let validSpaceId: number | null = null
  if (spaceId) {
    // RLS garante que só spaces visíveis (próprios ou compartilhados) aparecem
    const { data: space } = await supabase.from('spaces').select('id').eq('id', spaceId).single()
    if (!space) return notFound('Pasta não encontrada ou sem acesso.')
    validSpaceId = space.id
  }

  const { error } = await supabase.from('meetings').update({ space_id: validSpaceId }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, spaceId: validSpaceId })
}

// Soft-delete: move para lixeira (deleted_at = now)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  const { id } = await params
  // meetings_delete_own policy garante que só o dono pode deletar
  const { error } = await supabase
    .from('meetings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/briefing')
  revalidatePath('/meetings')
  return NextResponse.json({ ok: true })
}
