import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, adminClient } from '@/lib/superAdmin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { orgId } = await params
  const db = adminClient()

  const [{ data: org }, { data: members }, { data: settings }, { data: briefings }] = await Promise.all([
    db.from('organizations').select('id, name, plan, created_at').eq('id', orgId).maybeSingle(),
    db.from('organization_members').select('user_id, role, created_at').eq('organization_id', orgId),
    db.from('org_settings').select('*').eq('org_id', orgId).maybeSingle(),
    db.from('org_briefings').select('date, created_at').eq('org_id', orgId).order('date', { ascending: false }).limit(30),
  ])

  const { data: authData } = await db.auth.admin.listUsers()
  const authMap: Record<string, { name: string; email: string; lastSignIn: string | null }> = {}
  for (const u of authData?.users ?? []) {
    authMap[u.id] = {
      name: u.user_metadata?.full_name ?? u.email ?? u.id,
      email: u.email ?? '',
      lastSignIn: u.last_sign_in_at ?? null,
    }
  }

  const enrichedMembers = (members ?? []).map(m => ({
    ...m,
    ...authMap[m.user_id],
  }))

  return NextResponse.json({ org, members: enrichedMembers, settings, briefings })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { orgId } = await params
  const body = await req.json()
  const db = adminClient()

  // Atualiza plano da org
  if (body.plan) {
    await db.from('organizations').update({ plan: body.plan }).eq('id', orgId)
  }

  // Atualiza feature_overrides ou outras settings
  if (body.feature_overrides !== undefined || body.ai_model !== undefined) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.feature_overrides !== undefined) updates.feature_overrides = body.feature_overrides
    if (body.ai_model !== undefined) updates.ai_model = body.ai_model

    await db.from('org_settings')
      .upsert({ org_id: orgId, ...updates }, { onConflict: 'org_id' })
  }

  return NextResponse.json({ ok: true })
}
