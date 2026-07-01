import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString()

  const [
    { data: meetings },
    { data: lastMonthMeetings },
    { data: contacts },
    { data: apiKeys },
  ] = await Promise.all([
    supabase.from('meetings').select('id, title, created_at, duration_seconds, word_count, attendees, enhancement').gte('created_at', thisMonthStart).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('meetings').select('id, duration_seconds').gte('created_at', lastMonthStart).lt('created_at', thisMonthStart).is('deleted_at', null),
    supabase.from('contacts').select('id, name, email, meeting_count, last_seen').order('meeting_count', { ascending: false }).limit(8),
    supabase.from('api_keys').select('id, name, last_used_at').is('revoked_at', null),
  ])

  const totalMeetings = meetings?.length ?? 0
  const lastMonthTotal = lastMonthMeetings?.length ?? 0
  const diffMeetings = totalMeetings - lastMonthTotal

  const totalSecs = (meetings ?? []).reduce((acc, m) => acc + (m.duration_seconds ?? 0), 0)
  const totalHours = Math.floor(totalSecs / 3600)
  const totalMinRemainder = Math.floor((totalSecs % 3600) / 60)
  const avgMin = totalMeetings > 0 ? Math.round(totalSecs / 60 / totalMeetings) : 0

  const lastMonthSecs = (lastMonthMeetings ?? []).reduce((acc, m) => acc + (m.duration_seconds ?? 0), 0)
  const diffHours = Math.floor(totalSecs / 3600) - Math.floor(lastMonthSecs / 3600)

  const totalWords = (meetings ?? []).reduce((acc, m) => acc + (m.word_count ?? 0), 0)

  // Top domínios/empresas
  const domainMap: Record<string, number> = {}
  for (const c of contacts ?? []) {
    const domain = c.email?.split('@')[1]
    if (domain) domainMap[domain] = (domainMap[domain] ?? 0) + (c.meeting_count ?? 0)
  }
  const topDomains = Object.entries(domainMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const recentMeetings = (meetings ?? []).slice(0, 6)
  const month = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white capitalize">Dashboard — {month}</h1>
        <p className="text-sm text-neutral-500 mt-1">Visão consolidada do mês atual</p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Reuniões</p>
          <p className="text-3xl font-semibold text-white">{totalMeetings}</p>
          {diffMeetings !== 0 && (
            <p className={`text-xs mt-1 ${diffMeetings > 0 ? 'text-green-500' : 'text-red-400'}`}>
              {diffMeetings > 0 ? '+' : ''}{diffMeetings} vs mês anterior
            </p>
          )}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Horas gravadas</p>
          <p className="text-3xl font-semibold text-white">{totalHours}h{totalMinRemainder > 0 ? <span className="text-lg text-neutral-400"> {totalMinRemainder}min</span> : ''}</p>
          {diffHours !== 0 && (
            <p className={`text-xs mt-1 ${diffHours > 0 ? 'text-green-500' : 'text-red-400'}`}>
              {diffHours > 0 ? '+' : ''}{diffHours}h vs mês anterior
            </p>
          )}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Média por reunião</p>
          <p className="text-3xl font-semibold text-white">{avgMin}<span className="text-lg text-neutral-400"> min</span></p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Palavras transcritas</p>
          <p className="text-3xl font-semibold text-white">{totalWords > 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}</p>
        </div>
      </div>

      {/* Secundárias */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Pessoas encontradas</p>
          <p className="text-2xl font-semibold text-white">{contacts?.length ?? 0}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Empresas distintas</p>
          <p className="text-2xl font-semibold text-white">{topDomains.length}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Chaves de API ativas</p>
          <p className="text-2xl font-semibold text-white">{apiKeys?.length ?? 0}</p>
          {(apiKeys ?? []).some(k => k.last_used_at) && (
            <p className="text-xs text-neutral-600 mt-1">
              Último uso {new Date((apiKeys ?? []).find(k => k.last_used_at)!.last_used_at!).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Reuniões do mês */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Reuniões do mês</h2>
            <Link href="/meetings" className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">Ver todas →</Link>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma reunião este mês.</p>
            ) : recentMeetings.map((m, i) => {
              let attendees: { name: string }[] = []
              try { attendees = m.attendees ? (Array.isArray(m.attendees) ? m.attendees : JSON.parse(m.attendees)) : [] } catch {}
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className={`block px-5 py-3.5 hover:bg-white/[0.03] transition-colors ${i < recentMeetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white truncate">{m.title}</p>
                    <span className="text-xs text-neutral-600 shrink-0">{formatDuration(m.duration_seconds)}</span>
                  </div>
                  {attendees.length > 0 && (
                    <p className="text-xs text-neutral-600 mt-0.5 truncate">
                      {attendees.slice(0, 3).map(a => a.name).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-neutral-700 mt-0.5">
                    {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          {/* Top pessoas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Top pessoas</h2>
              <Link href="/people" className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">Ver todas →</Link>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              {!contacts || contacts.length === 0 ? (
                <p className="text-sm text-neutral-600 p-5">Nenhum contato ainda.</p>
              ) : contacts.slice(0, 4).map((c, i) => {
                const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                const colors = ['#6C8EFF', '#a78bfa', '#22c55e', '#f59e0b']
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-5 py-3 ${i < 3 ? 'border-b border-white/[0.05]' : ''}`}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: colors[i % colors.length] }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    </div>
                    <span className="text-xs text-neutral-600 shrink-0">{c.meeting_count} reuniões</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top empresas */}
          {topDomains.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Top empresas</h2>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {topDomains.map(([domain, count], i) => (
                  <div key={domain} className={`flex items-center justify-between px-5 py-3 ${i < topDomains.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                    <p className="text-sm text-white">{domain}</p>
                    <span className="text-xs text-neutral-600">{count} reuniões</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
