import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import ActionsClient from '@/components/ActionsClient'

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function ActionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user?.email
    ? await service.from('profiles').select('id').eq('email', user.email).single()
    : { data: null }

  const { data: actions } = profile
    ? await service
        .from('action_items')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return <ActionsClient initial={actions ?? []} />
}
