import { NextResponse } from 'next/server'
import { isSuperAdmin, adminClient } from '@/lib/superAdmin'

export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = adminClient()

  const [{ data: orgs }, { data: authData }, { data: plans }] = await Promise.all([
    db.from('organizations').select('id, name, plan, created_at').order('created_at', { ascending: false }),
    db.auth.admin.listUsers(),
    db.from('plan_features').select('plan, label, features'),
  ])

  const memberCounts: Record<string, number> = {}
  const { data: members } = await db
    .from('organization_members')
    .select('organization_id')

  for (const m of members ?? []) {
    memberCounts[m.organization_id] = (memberCounts[m.organization_id] ?? 0) + 1
  }

  const { data: settings } = await db
    .from('org_settings')
    .select('org_id, ms365_enabled, teams_meetings_enabled, whatsapp_enabled, ai_model, feature_overrides')

  const settingsMap: Record<string, typeof settings[0]> = {}
  for (const s of settings ?? []) settingsMap[s.org_id] = s

  const enriched = (orgs ?? []).map(org => ({
    id: org.id,
    name: org.name,
    plan: org.plan,
    createdAt: org.created_at,
    memberCount: memberCounts[org.id] ?? 0,
    settings: settingsMap[org.id] ?? null,
  }))

  const totalUsers = authData?.users?.length ?? 0
  const planMap: Record<string, { label: string; features: Record<string, unknown> }> = {}
  for (const p of plans ?? []) planMap[p.plan] = { label: p.label, features: p.features }

  return NextResponse.json({
    orgs: enriched,
    totalUsers,
    plans: planMap,
  })
}
