import { createClient } from '@/lib/supabase/server'
import ActionsClient from '@/components/ActionsClient'

export default async function ActionsPage() {
  const supabase = await createClient()

  // action_items_own policy filtra automaticamente por auth_profile_id()
  const { data: actions } = await supabase
    .from('action_items')
    .select('*')
    .order('created_at', { ascending: false })

  return <ActionsClient initial={actions ?? []} />
}
