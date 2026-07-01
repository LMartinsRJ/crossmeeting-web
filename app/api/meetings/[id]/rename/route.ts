import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const { id } = await params
  const { data: meeting } = await service.from('meetings').select('id, user_id').eq('id', id).eq('user_id', profile.id).single()
  if (!meeting) return NextResponse.json({ error: 'Reunião não encontrada ou você não é o dono.' }, { status: 404 })

  const { title } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Título não pode ser vazio.' }, { status: 400 })

  const { error } = await service.from('meetings').update({ title: title.trim() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
