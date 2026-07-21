import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreActions, buildAreaOverdueRates, type ActionInput } from '@/lib/attentionScore'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: actions } = await supabase
    .from('action_items')
    .select('id, text, due_date, done_at, status, prioridade, area, updated_at, owner, meeting_title')
    .eq('user_id', user.id)
    .is('done_at', null)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })

  const all = (actions ?? []) as ActionInput[]
  const rates = buildAreaOverdueRates(all)
  const scored = scoreActions(all, rates)

  return NextResponse.json({ actions: scored.slice(0, 20) })
}
