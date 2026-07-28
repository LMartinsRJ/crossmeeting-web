import { createClient } from '@/lib/supabase/server'
import CompanyCard from './CompanyCard'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, meeting_count, last_seen')
    .order('last_seen', { ascending: false })

  type Contact = NonNullable<typeof contacts>[number]

  // Group by domain
  const companyMap = new Map<string, { domain: string; contacts: Contact[]; totalMeetings: number; lastSeen: string }>()
  for (const c of contacts ?? []) {
    const domain = c.email.split('@')[1] ?? 'unknown'
    if (!companyMap.has(domain)) {
      companyMap.set(domain, { domain, contacts: [], totalMeetings: 0, lastSeen: c.last_seen })
    }
    const entry = companyMap.get(domain)!
    entry.contacts.push(c)
    entry.totalMeetings += c.meeting_count ?? 0
    if (c.last_seen > entry.lastSeen) entry.lastSeen = c.last_seen
  }

  const companies = Array.from(companyMap.values()).sort((a, b) => b.totalMeetings - a.totalMeetings)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Empresas</h1>
        <span className="text-sm text-neutral-500">{companies.length} empresas</span>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm text-neutral-600">Nenhuma empresa encontrada ainda. As empresas são detectadas automaticamente a partir dos participantes das reuniões.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company, i) => (
            <CompanyCard key={company.domain} company={company} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
