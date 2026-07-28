'use client'

const colors = ['#6C8EFF', '#a78bfa', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316']

function domainInitials(domain: string) {
  return domain.replace(/\.(com|net|org|io|ai|br|co).*/, '').slice(0, 2).toUpperCase()
}

type Contact = { id: number; name: string; email: string; meeting_count: number | null; last_seen: string }
type Company = { domain: string; contacts: Contact[]; totalMeetings: number; lastSeen: string }

export default function CompanyCard({ company, index }: { company: Company; index: number }) {
  const color = colors[index % colors.length]
  const logoUrl = `https://logo.clearbit.com/${company.domain}`
  const lastDate = new Date(company.lastSeen).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative" style={{ background: color }}>
          <img
            src={logoUrl}
            alt={company.domain}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className="text-white text-xs font-bold absolute">{domainInitials(company.domain)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{company.domain}</p>
          <p className="text-xs text-neutral-600 mt-0.5">
            {company.contacts.length} {company.contacts.length === 1 ? 'pessoa' : 'pessoas'} · {company.totalMeetings} reuniões · último contato {lastDate}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {company.contacts.map(c => {
          const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          return (
            <div key={c.id} className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-3 py-1.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0" style={{ background: color }}>
                {initials}
              </div>
              <span className="text-xs text-neutral-300">{c.name}</span>
              <span className="text-[10px] text-neutral-600">{c.meeting_count}x</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
