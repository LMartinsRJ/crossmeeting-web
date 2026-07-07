import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TrashActions from './TrashActions'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

function daysUntilPurge(deletedAt: string): number {
  const purgeAt = new Date(deletedAt).getTime() + 15 * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

export default async function TrashPage() {
  const supabase = await createClient()

  // meetings_select_own policy filtra automaticamente por auth_profile_id()
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, created_at, duration_seconds, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/meetings" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
          ← Reuniões
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lixeira</h1>
          <p className="text-xs text-neutral-600 mt-1">Reuniões apagadas permanentemente após 15 dias</p>
        </div>
        <span className="text-sm text-neutral-500">{meetings?.length ?? 0} {meetings?.length === 1 ? 'reunião' : 'reuniões'}</span>
      </div>

      {!meetings || meetings.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🗑️</p>
          <p className="text-sm text-neutral-500">A lixeira está vazia.</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          {meetings.map((m, i) => {
            const days = daysUntilPurge(m.deleted_at)
            return (
              <div
                key={m.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < meetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-400 truncate line-through">{m.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-neutral-700">
                      {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {m.duration_seconds > 0 && ` · ${formatDuration(m.duration_seconds)}`}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      days <= 2
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-white/[0.04] text-neutral-600 border border-white/[0.06]'
                    }`}>
                      {days === 0 ? 'Apaga hoje' : `Apaga em ${days} dia${days !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>
                <TrashActions meetingId={m.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
