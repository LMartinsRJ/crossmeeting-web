import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getOrgContext } from '@/lib/enterprise'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// DELETE /api/org/members/[userId] — remove member
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (userId === user?.id) {
    return NextResponse.json({ error: 'Não é possível remover a si mesmo' }, { status: 400 })
  }

  const admin = adminClient()
  await admin.from('organization_members').delete()
    .eq('organization_id', org.orgId)
    .eq('user_id', userId)

  // Clear org from profile — find profile by matching auth user id via organization_members lookup
  // We use admin to update profiles — find the profile with this auth user's email
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  if (authUser?.user?.email) {
    await admin.from('profiles')
      .update({ organization_id: null, org_role: null })
      .eq('email', authUser.user.email)
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/org/members/[userId] — change role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { role } = await req.json()
  if (!['admin', 'manager', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Role inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  await supabase.from('organization_members')
    .update({ role })
    .eq('organization_id', org.orgId)
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
