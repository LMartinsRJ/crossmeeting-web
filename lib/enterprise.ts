import { createClient } from '@/lib/supabase/server'

export type OrgTier = 'individual' | 'team' | 'enterprise'

export interface OrgContext {
  tier: OrgTier
  orgId: string | null
  orgName: string | null
  orgRole: 'admin' | 'manager' | 'member' | null
}

export async function getOrgContext(): Promise<OrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tier: 'individual', orgId: null, orgName: null, orgRole: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, org_role')
    .maybeSingle()

  if (!profile?.organization_id) {
    return { tier: 'individual', orgId: null, orgName: null, orgRole: null }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, plan')
    .eq('id', profile.organization_id)
    .maybeSingle()

  return {
    tier: (org?.plan as OrgTier) ?? 'team',
    orgId: profile.organization_id,
    orgName: org?.name ?? null,
    orgRole: profile.org_role as OrgContext['orgRole'],
  }
}
