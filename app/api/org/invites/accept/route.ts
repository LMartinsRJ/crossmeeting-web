import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/org/invites/accept — accept invite by token
export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 })

  // Fetch invite (anyone can read by token — RLS allows it)
  const { data: invite } = await supabase
    .from('organization_invites')
    .select('id, organization_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Convite não encontrado ou inválido' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Convite já utilizado' }, { status: 409 })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
  }
  if (invite.email !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Este convite é para outro e-mail' }, { status: 403 })
  }

  const admin = adminClient()

  // Add to organization_members (upsert in case of re-invite)
  await admin.from('organization_members').upsert({
    organization_id: invite.organization_id,
    user_id: user.id,
    role: invite.role ?? 'member',
  }, { onConflict: 'organization_id,user_id' })

  // Update profile with org (RLS on profiles uses email filter)
  await admin.from('profiles')
    .update({ organization_id: invite.organization_id, org_role: invite.role ?? 'member' })
    .eq('email', user.email)

  // Mark invite as accepted
  await admin.from('organization_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, orgId: invite.organization_id })
}

// GET /api/org/invites/accept?token=xxx — preview invite (before accepting)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = await createClient()
  const { data: invite } = await supabase
    .from('organization_invites')
    .select('email, role, expires_at, accepted_at, organization_id')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Convite já utilizado' }, { status: 409 })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
  }

  // Fetch org name
  const { data: org } = await supabase
    .from('organizations')
    .select('name, plan')
    .eq('id', invite.organization_id)
    .maybeSingle()

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    orgName: org?.name,
    orgPlan: org?.plan,
    expiresAt: invite.expires_at,
  })
}
