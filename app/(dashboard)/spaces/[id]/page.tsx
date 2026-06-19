import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ShareSpaceModal from '@/components/ShareSpaceModal'
import ImportTranscriptModal from '@/components/ImportTranscriptModal'

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

export default async function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) notFound()

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
  if (!profile) notFound()

  const { data: space } = await service.from('spaces').select('*').eq('id', id).single()
  if (!space) notFound()

  const isOwner = space.user_id === profile.id
  let isMember = isOwner
  let ownerName: string | null = null
  if (!isOwner) {
    const { data: share } = await service
      .from('space_shares').select('id').eq('space_id', id).eq('shared_with_id', profile.id).single()
    isMember = !!share
    const { data: owner } = await service.from('profiles').select('name, email').eq('id', space.user_id).single()
    ownerName = owner?.name ?? owner?.email ?? null
  }
  if (!isMember) notFound()

  const { data: meetings } = await service
    .from('meetings')
    .select('id, title, created_at, duration_seconds, enhancement, attendees')
    .eq('space_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/spaces" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-6 inline-block">
        ← Todas as pastas
      </Link>

      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{space.emoji}</span>
          <div>
            <h1 className="text-2xl font-semibold text-white">{space.name}</h1>
            {!isOwner && ownerName && (
              <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full inline-block mt-1">
                Compartilhada por {ownerName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && <ShareSpaceModal spaceId={space.id} />}
          <ImportTranscriptModal defaultSpaceId={space.id} label="Importar para esta pasta" />
        </div>
      </div>

      <p className="text-sm text-neutral-500 mb-8">{meetings?.length ?? 0} reuniões nesta pasta</p>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {!meetings || meetings.length === 0 ? (
          <p className="text-sm text-neutral-600 p-6">
            Nenhuma reunião aqui ainda. Importe uma transcrição direto para esta pasta{!isOwner ? ' — todos com acesso vão ver.' : '.'}
          </p>
        ) : meetings.map((m, i) => {
          let summary: string | null = null
          let attendees: { name: string }[] = []
          try { summary = m.enhancement ? JSON.parse(m.enhancement)?.summary : null } catch {}
          try { attendees = m.attendees ? (Array.isArray(m.attendees) ? m.attendees : JSON.parse(m.attendees)) : [] } catch {}
          return (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className={`block px-6 py-4 hover:bg-white/[0.03] transition-colors ${i < meetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.title}</p>
                  {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                  {attendees.length > 0 && (
                    <p className="text-xs text-neutral-600 mt-1">{attendees.slice(0, 3).map(a => a.name).join(', ')}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-neutral-500">{new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{formatDuration(m.duration_seconds)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
