import type { SupabaseClient } from '@supabase/supabase-js'

// Garante que o usuário tem um space padrão ("Minhas Notas").
// Aceita qualquer cliente Supabase — o chamador é responsável por passar
// um cliente com as permissões corretas (sessão ou service role).
export async function getOrCreateDefaultSpace(client: SupabaseClient, userId: string) {
  const { data: existing } = await client
    .from('spaces').select('id, name, emoji').eq('user_id', userId).eq('is_default', true).single()
  if (existing) return existing

  const { data: created, error } = await client
    .from('spaces')
    .insert({ user_id: userId, name: 'Minhas Notas', emoji: '🗒️', is_default: true })
    .select('id, name, emoji')
    .single()
  if (error) throw error
  return created
}
