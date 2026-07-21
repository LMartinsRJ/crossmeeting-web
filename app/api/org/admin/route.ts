import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getOrgContext } from '@/lib/enterprise'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = admin()
  const today = new Date().toISOString().split('T')[0]

  // Org info
  const { data: orgData } = await db
    .from('organizations')
    .select('name, plan, created_at')
    .eq('id', org.orgId)
    .maybeSingle()

  // Members + auth info
  const { data: members } = await db
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('organization_id', org.orgId)
    .order('created_at')

  const { data: authData } = await db.auth.admin.listUsers()
  const authMap: Record<string, { name: string; email: string; avatar: string | null; lastSignIn: string | null }> = {}
  for (const u of authData?.users ?? []) {
    authMap[u.id] = {
      name: u.user_metadata?.full_name ?? u.email ?? u.id,
      email: u.email ?? '',
      avatar: u.user_metadata?.avatar_url ?? null,
      lastSignIn: u.last_sign_in_at ?? null,
    }
  }

  // Calendar integration status from profiles
  const memberEmails = Object.values(authMap)
    .filter(u => (members ?? []).some((m: { user_id: string }) => authMap[m.user_id]?.email === u.email))
    .map(u => u.email)

  const { data: profiles } = await db
    .from('profiles')
    .select('email, calendar_provider, google_calendar_token, microsoft_calendar_token, calendar_token_updated_at')
    .in('email', memberEmails)

  const profileMap: Record<string, { provider: string | null; hasToken: boolean; updatedAt: string | null }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.email] = {
      provider: p.calendar_provider,
      hasToken: !!(p.google_calendar_token || p.microsoft_calendar_token),
      updatedAt: p.calendar_token_updated_at,
    }
  }

  // Action items summary per member
  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
  const { data: actions } = await db
    .from('action_items')
    .select('user_id, status, done_at, due_date, created_at')
    .in('user_id', memberIds)

  const actionsByMember: Record<string, { total: number; open: number; overdue: number }> = {}
  const now = today
  for (const a of actions ?? []) {
    const uid = a.user_id
    if (!actionsByMember[uid]) actionsByMember[uid] = { total: 0, open: 0, overdue: 0 }
    actionsByMember[uid].total++
    if (!a.done_at && a.status !== 'done') {
      actionsByMember[uid].open++
      if (a.due_date && a.due_date < now) actionsByMember[uid].overdue++
    }
  }

  // Briefing history (last 7 days)
  const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data: briefings } = await db
    .from('org_briefings')
    .select('date, created_at, stats')
    .eq('org_id', org.orgId)
    .gte('date', sevenAgo)
    .order('date', { ascending: false })

  // Pending invites
  const { data: invites } = await db
    .from('organization_invites')
    .select('id, email, role, expires_at, created_at')
    .eq('organization_id', org.orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  const enrichedMembers = (members ?? []).map((m: { user_id: string; role: string; created_at: string }) => {
    const auth = authMap[m.user_id]
    const cal = auth ? profileMap[auth.email] : null
    const acts = actionsByMember[m.user_id] ?? { total: 0, open: 0, overdue: 0 }
    return {
      userId: m.user_id,
      name: auth?.name ?? m.user_id,
      email: auth?.email ?? '',
      avatar: auth?.avatar ?? null,
      lastSignIn: auth?.lastSignIn ?? null,
      role: m.role,
      joinedAt: m.created_at,
      calendar: cal ?? null,
      actions: acts,
    }
  })

  return NextResponse.json({
    org: {
      id: org.orgId,
      name: orgData?.name,
      plan: orgData?.plan,
      createdAt: orgData?.created_at,
    },
    members: enrichedMembers,
    invites: invites ?? [],
    briefings: briefings ?? [],
    totalActions: (actions ?? []).length,
  })
}
