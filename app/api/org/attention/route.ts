import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getOrgContext } from '@/lib/enterprise'
import { scoreActions, buildAreaOverdueRates, scoreLabel, type ActionInput } from '@/lib/attentionScore'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId) {
    return NextResponse.json({ error: 'Not an org member' }, { status: 403 })
  }

  const admin = adminClient()

  const { data: members } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', org.orgId)

  if (!members?.length) return NextResponse.json({ members: [], topCritical: [] })

  const memberIds = members.map(m => m.user_id)

  // Auth user names
  const { data: authData } = await admin.auth.admin.listUsers()
  const authMap: Record<string, string> = {}
  for (const u of authData?.users ?? []) {
    authMap[u.id] = u.user_metadata?.full_name ?? u.email ?? u.id
  }

  // All open actions for the org
  const { data: allActions } = await admin
    .from('action_items')
    .select('id, user_id, text, due_date, done_at, status, prioridade, area, updated_at, owner, meeting_title')
    .in('user_id', memberIds)
    .is('done_at', null)
    .neq('status', 'done')

  const actions = (allActions ?? []) as ActionInput[]
  const globalRates = buildAreaOverdueRates(actions)

  // Score per member
  const memberScores = members.map(m => {
    const ma = actions.filter(a => a.user_id === m.user_id)
    const scored = scoreActions(ma, globalRates)
    const avg = scored.length > 0
      ? Math.round(scored.reduce((s, a) => s + a.attention_score, 0) / scored.length)
      : 0
    const top = scored[0] ?? null
    return {
      userId: m.user_id,
      name: authMap[m.user_id] ?? m.user_id,
      role: m.role,
      openCount: scored.length,
      avgScore: avg,
      topAction: top ? {
        text: top.text,
        score: top.attention_score,
        reasons: top.score_reasons,
        ...scoreLabel(top.attention_score),
      } : null,
    }
  })

  memberScores.sort((a, b) => b.avgScore - a.avgScore)

  // Top 5 most critical across entire org
  const allScored = scoreActions(actions, globalRates)
  const topCritical = allScored.slice(0, 5).map(a => ({
    text: a.text,
    owner: a.owner ?? authMap[a.user_id ?? ''] ?? 'Desconhecido',
    area: a.area,
    score: a.attention_score,
    reasons: a.score_reasons,
    ...scoreLabel(a.attention_score),
  }))

  return NextResponse.json({ members: memberScores, topCritical })
}
