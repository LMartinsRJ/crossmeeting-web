import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getOrgContext } from '@/lib/enterprise'

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const admin = adminClient()

  // Get all org members (auth user IDs + emails via auth.users)
  const { data: members } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', org.orgId)

  if (!members?.length) {
    return NextResponse.json({ stats: emptyStats(), members: [], areas: [] })
  }

  const memberIds = members.map(m => m.user_id)

  // Get auth user emails for display names
  const { data: authData } = await admin.auth.admin.listUsers()
  const authMap: Record<string, string> = {}
  for (const u of authData?.users ?? []) {
    authMap[u.id] = u.user_metadata?.full_name ?? u.email ?? u.id
  }

  // Get all action items for this org's members
  const now = new Date().toISOString().split('T')[0]
  const { data: actions } = await admin
    .from('action_items')
    .select('user_id, status, prioridade, due_date, done_at, area, owner')
    .in('user_id', memberIds)

  const allActions = actions ?? []

  // Global stats
  const open = allActions.filter(a => !a.done_at && a.status !== 'done')
  const overdue = open.filter(a => a.due_date && a.due_date < now)
  const done = allActions.filter(a => !!a.done_at || a.status === 'done')

  const stats = {
    open: open.length,
    overdue: overdue.length,
    done: done.length,
    activeMembers: memberIds.length,
  }

  // Per-member breakdown
  const memberStats = members.map(m => {
    const ma = allActions.filter(a => a.user_id === m.user_id)
    const mOpen = ma.filter(a => !a.done_at && a.status !== 'done')
    const mOverdue = mOpen.filter(a => a.due_date && a.due_date < now)
    const mDone = ma.filter(a => !!a.done_at || a.status === 'done')
    const total = mOpen.length + mDone.length
    const rate = total > 0 ? Math.round((mDone.length / total) * 100) : null
    return {
      userId: m.user_id,
      name: authMap[m.user_id] ?? m.user_id,
      role: m.role,
      open: mOpen.length,
      overdue: mOverdue.length,
      done: mDone.length,
      completionRate: rate,
    }
  })

  // Per-area breakdown
  const areaMap: Record<string, { open: number; overdue: number; done: number }> = {}
  for (const a of allActions) {
    const area = a.area ?? 'Sem área'
    if (!areaMap[area]) areaMap[area] = { open: 0, overdue: 0, done: 0 }
    if (a.done_at || a.status === 'done') {
      areaMap[area].done++
    } else {
      areaMap[area].open++
      if (a.due_date && a.due_date < now) areaMap[area].overdue++
    }
  }
  const areas = Object.entries(areaMap)
    .map(([name, s]) => {
      const total = s.open + s.done
      return { name, ...s, completionRate: total > 0 ? Math.round((s.done / total) * 100) : null }
    })
    .sort((a, b) => b.overdue - a.overdue)

  // Critical alerts: overdue high-priority across org
  const alerts = allActions
    .filter(a => !a.done_at && a.status !== 'done' && a.due_date && a.due_date < now && a.prioridade === 'alta')
    .slice(0, 5)
    .map(a => ({
      owner: a.owner ?? authMap[a.user_id] ?? 'Desconhecido',
      area: a.area,
      daysOverdue: Math.floor((Date.now() - new Date(a.due_date).getTime()) / 86400000),
    }))

  return NextResponse.json({ stats, members: memberStats, areas, alerts })
}

function emptyStats() {
  return { open: 0, overdue: 0, done: 0, activeMembers: 0 }
}
