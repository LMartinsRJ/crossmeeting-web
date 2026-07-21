import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/enterprise'

// POST /api/org/members/invite — create invite
export async function POST(req: NextRequest) {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role = 'member' } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
  }

  const supabase = await createClient()

  // Check if already a member via profiles
  const { data: existing } = await supabase
    .from('organization_invites')
    .select('id, accepted_at, expires_at')
    .eq('organization_id', org.orgId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .maybeSingle()

  if (existing) {
    // Revoke and recreate so we get a fresh token + 7-day expiry
    await supabase.from('organization_invites').delete().eq('id', existing.id)
  }

  const { data: invite, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: org.orgId,
      email: email.toLowerCase(),
      role,
    })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const link = `${baseUrl}/accept-invite?token=${invite.token}`

  return NextResponse.json({ link, token: invite.token })
}

// GET /api/org/members/invite — list pending invites
export async function GET() {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('organization_invites')
    .select('id, email, role, expires_at, created_at')
    .eq('organization_id', org.orgId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({ invites: data ?? [] })
}

// DELETE /api/org/members/invite?id=xxx — revoke invite
export async function DELETE(req: NextRequest) {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = await createClient()
  await supabase.from('organization_invites').delete().eq('id', id).eq('organization_id', org.orgId)

  return NextResponse.json({ ok: true })
}
