import type { SupabaseClient } from '@supabase/supabase-js'

// Garante que o usuário tem um space padrão ("Minhas Notas") — mesmo conceito do
// app desktop, onde toda reunião sempre pertence a algum space.
export async function getOrCreateDefaultSpace(service: SupabaseClient, userId: string) {
  const { data: existing } = await service
    .from('spaces').select('id, name, emoji').eq('user_id', userId).eq('is_default', true).single()
  if (existing) return existing

  const { data: created, error } = await service
    .from('spaces')
    .insert({ user_id: userId, name: 'Minhas Notas', emoji: '🗒️', is_default: true })
    .select('id, name, emoji')
    .single()
  if (error) throw error
  return created
}
