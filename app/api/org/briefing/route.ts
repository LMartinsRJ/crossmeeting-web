import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getOrgContext } from '@/lib/enterprise'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId) {
    return NextResponse.json({ error: 'Not an org member' }, { status: 403 })
  }

  const date = new URL(req.url).searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const admin = adminClient()
  const { data: briefing } = await admin
    .from('org_briefings')
    .select('content, stats, created_at, date')
    .eq('org_id', org.orgId)
    .eq('date', date)
    .maybeSingle()

  return NextResponse.json({ briefing: briefing ?? null, date })
}

// POST — gerar briefing on-demand (admin only)
export async function POST() {
  const org = await getOrgContext()
  if (org.tier === 'individual' || !org.orgId || org.orgRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-org-briefing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: org.orgId }),
    }
  )

  if (!res.ok) return NextResponse.json({ error: 'Falha ao gerar briefing' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
