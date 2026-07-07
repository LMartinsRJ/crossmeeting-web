import { NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'

export async function GET() {
  const { supabase, user } = await getAuthContext()
  if (!user) return unauthorized()

  // action_items_own policy filtra automaticamente por auth_profile_id()
  const { data } = await supabase
    .from('action_items')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}
