import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Retorna o cliente Supabase com a sessão do usuário, o user e o perfil.
 * Com RLS configurado, o cliente de sessão filtra automaticamente por
 * auth_profile_id() — sem precisar do service role key.
 */
export async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .maybeSingle()

  return { supabase, user, profile: profile as { id: string } | null }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
}

export function notFound(msg = 'Não encontrado.') {
  return NextResponse.json({ error: msg }, { status: 404 })
}
