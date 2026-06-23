import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Timestamps de compartilhamentos recebidos (para o cliente calcular o que é novo)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const [{ data: spaceShares }, { data: meetingShares }] = await Promise.all([
    service.from('space_shares').select('created_at').eq('shared_with_id', profile.id),
    service.from('meeting_shares').select('created_at').eq('shared_with_id', profile.id),
  ])

  const timestamps = [...(spaceShares ?? []), ...(meetingShares ?? [])].map(r => r.created_at)
  return NextResponse.json({ timestamps })
}
