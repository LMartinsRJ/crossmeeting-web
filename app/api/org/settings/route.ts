import { NextRequest, NextResponse } from 'next/server'
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
  if (!org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = admin()
  const { data } = await db
    .from('org_settings')
    .select('ms365_tenant_id, ms365_client_id, ms365_enabled, teams_meetings_enabled, google_workspace_enabled, whatsapp_url, whatsapp_instance, whatsapp_enabled, ai_provider, ai_model, ai_custom_endpoint, notifications, feature_overrides')
    .eq('org_id', org.orgId)
    .maybeSingle()

  // Nunca retorna secrets ao frontend
  return NextResponse.json({ settings: data ?? null })
}

export async function PATCH(req: NextRequest) {
  const org = await getOrgContext()
  if (!org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const db = admin()

  // Campos permitidos para org admin (sem feature_overrides — só super admin)
  const allowed = [
    'ms365_tenant_id', 'ms365_client_id', 'ms365_client_secret',
    'ms365_enabled', 'teams_meetings_enabled',
    'google_workspace_enabled',
    'whatsapp_url', 'whatsapp_api_key', 'whatsapp_instance', 'whatsapp_enabled',
    'ai_provider', 'ai_model', 'ai_api_key', 'ai_custom_endpoint',
    'notifications',
  ] as const

  const updates: Record<string, unknown> = { org_id: org.orgId, updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  await db.from('org_settings').upsert(updates, { onConflict: 'org_id' })

  return NextResponse.json({ ok: true })
}
