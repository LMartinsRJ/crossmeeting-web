import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/enterprise'

export async function GET() {
  const org = await getOrgContext()
  return NextResponse.json({
    tier: org.tier,
    orgId: org.orgId,
    orgName: org.orgName,
    orgRole: org.orgRole,
  })
}
