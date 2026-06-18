import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const firstName = (user?.user_metadata?.full_name as string ?? 'você').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [{ data: meetings }, { data: contacts }, { data: apiKeys }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees')
      .gte('created_at', thisMonthStart)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('contacts')
      .select('id, name, email, meeting_count, last_seen')
      .order('meeting_count', { ascending: false })
      .limit(5),
    supabase
      .from('api_keys')
      .select('id')
      .is('revoked_at', null),
  ])

  const totalMeetings = meetings?.length ?? 0
  const totalMinutes = Math.round((meetings ?? []).reduce((acc, m) => acc + (m.duration_seconds ?? 0), 0) / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const recentMeetings = (meetings ?? []).slice(0, 5)

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">{greeting}, {firstName}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Reuniões este mês</p>
          <p className="text-3xl font-semibold text-white">{totalMeetings}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Horas gravadas</p>
          <p className="text-3xl font-semibold text-white">
            {totalHours}h{totalMinutes % 60 > 0 ? <span className="text-lg text-neutral-400"> {totalMinutes % 60}min</span> : ''}
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Pessoas encontradas</p>
          <p className="text-3xl font-semibold text-white">{contacts?.length ?? 0}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-xs text-neutral-500 mb-2">Chaves de API ativas</p>
          <p className="text-3xl font-semibold text-white">{apiKeys?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Reuniões recentes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Reuniões recentes</h2>
            <Link href="/meetings" className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">Ver todas →</Link>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhuma reunião este mês. Abra o app desktop e grave sua primeira reunião.</p>
            ) : recentMeetings.map((m, i) => {
              let summary: string | null = null
              try { summary = m.enhancement ? JSON.parse(m.enhancement)?.summary : null } catch {}
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className={`block px-5 py-4 hover:bg-white/[0.03] transition-colors ${i < recentMeetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <p className="text-sm font-medium text-white truncate">{m.title}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {formatDate(m.created_at)} · {formatDuration(m.duration_seconds)}
                  </p>
                  {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Pessoas chave */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pessoas chave</h2>
            <Link href="/people" className="text-xs text-[#6C8EFF] hover:opacity-80 transition-opacity">Ver todas →</Link>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {!contacts || contacts.length === 0 ? (
              <p className="text-sm text-neutral-600 p-5">Nenhum contato encontrado ainda.</p>
            ) : contacts.map((c, i) => {
              const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              const colors = ['#6C8EFF', '#a78bfa', '#22c55e', '#f59e0b', '#ec4899']
              const color = colors[i % colors.length]
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-5 py-3.5 ${i < contacts.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: color }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-xs text-neutral-600 truncate">{c.email}</p>
                  </div>
                  <span className="text-[11px] text-neutral-600 shrink-0">{c.meeting_count} reuniões</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Briefing do dia */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Briefing do dia</h2>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <p className="text-sm text-neutral-400 leading-relaxed">
            O briefing diário automático chegará aqui — um resumo gerado por IA com suas reuniões do dia, ações pendentes e pessoas-chave para acompanhar. Esta funcionalidade faz parte da <span className="text-[#6C8EFF]">Fase 12</span> do roadmap.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] bg-[#6C8EFF]/10 text-[#6C8EFF] border border-[#6C8EFF]/20 px-2 py-1 rounded-full">Em breve</span>
            <span className="text-xs text-neutral-600">Email diário · Resumo semanal · Alertas de ações vencendo</span>
          </div>
        </div>
      </div>

    </div>
  )
}
