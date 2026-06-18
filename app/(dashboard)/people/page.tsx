import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PeoplePage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('last_seen', { ascending: false })

  const colors = ['#6C8EFF', '#a78bfa', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316']

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Pessoas</h1>
        <span className="text-sm text-neutral-500">{contacts?.length ?? 0} contatos</span>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {!contacts || contacts.length === 0 ? (
          <p className="text-sm text-neutral-600 p-6">Nenhum contato encontrado ainda.</p>
        ) : contacts.map((c, i) => {
          const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          const color = colors[i % colors.length]
          const domain = c.email.split('@')[1]
          return (
            <div
              key={c.id}
              className={`flex items-center gap-4 px-6 py-4 ${i < contacts.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0" style={{ background: color }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                <p className="text-xs text-neutral-600 truncate">{c.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-neutral-500">{c.meeting_count} reuniões</p>
                <p className="text-xs text-neutral-700 mt-0.5">{domain}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
