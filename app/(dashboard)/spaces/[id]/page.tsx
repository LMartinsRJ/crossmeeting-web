import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { parseAttendees, parseEnhancementSummary } from '@/lib/parsers'
import Link from 'next/link'
import ShareSpaceModal from '@/components/ShareSpaceModal'
import DeleteSpaceButton from '@/components/DeleteSpaceButton'
import ImportTranscriptModal from '@/components/ImportTranscriptModal'
import DraggableMeetingRow from '@/components/DraggableMeetingRow'
import SpaceDropTargets from '@/components/SpaceDropTargets'
import MeetingSelectionProvider from '@/components/MeetingSelectionContext'

function formatDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

export default async function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // spaces RLS: SELECT own + SELECT via space_shares — se não visível, retorna null
  const { data: space } = await supabase.from('spaces').select('*').eq('id', id).single()
  if (!space) notFound()

  // profiles_select_own: retorna o perfil do usuário autenticado
  const { data: profile } = await supabase.from('profiles').select('id').maybeSingle()
  const isOwner = !!profile && space.user_id === profile.id

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, created_at, duration_seconds, enhancement, attendees')
    .eq('space_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Resto do JSX permanece igual — só substituímos a fonte de dados
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/spaces" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-6 inline-block">
        ← Todos os spaces
      </Link>
      <SpaceDetailContent
        space={space}
        isOwner={isOwner}
        meetings={meetings ?? []}
        spaceId={id}
      />
    </div>
  )
}

function SpaceDetailContent({
  space,
  isOwner,
  meetings,
  spaceId,
}: {
  space: any
  isOwner: boolean
  meetings: any[]
  spaceId: string
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {space.emoji && <span className="text-3xl">{space.emoji}</span>}
          <div>
            <h1 className="text-2xl font-semibold text-white">{space.name}</h1>
            {!isOwner && (
              <p className="text-xs text-neutral-500 mt-0.5">Space compartilhado</p>
            )}
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 shrink-0">
            <ShareSpaceModal spaceId={Number(spaceId)} />
            {!space.is_default && <DeleteSpaceButton spaceId={Number(spaceId)} spaceName={space.name} />}
          </div>
        )}
      </div>

      <MeetingSelectionProvider>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-neutral-500">
            {meetings.length} {meetings.length === 1 ? 'reunião' : 'reuniões'}
          </p>
          <ImportTranscriptModal defaultSpaceId={Number(spaceId)} />
        </div>

        <SpaceDropTargets />

        {meetings.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
            <p className="text-sm text-neutral-500">Nenhuma reunião neste space ainda.</p>
            <p className="text-xs text-neutral-700 mt-2">Arraste reuniões para cá ou use o botão "Importar" acima.</p>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {meetings.map((m, i) => {
              const summary = parseEnhancementSummary(m.enhancement)
              const attendees = parseAttendees(m.attendees)
              return (
                <div key={m.id} className={`relative group flex items-center ${i < meetings.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                  <DraggableMeetingRow
                    meetingId={m.id}
                    href={`/meetings/${m.id}`}
                    title={m.title}
                    className="flex-1 min-w-0 px-6 py-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 pr-8">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.title}</p>
                        {summary && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{summary}</p>}
                        {attendees.length > 0 && (
                          <p className="text-xs text-neutral-600 mt-1">
                            {attendees.slice(0, 3).map(a => a.name).join(', ')}
                            {attendees.length > 3 ? ` +${attendees.length - 3}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-neutral-500">
                          {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-xs text-neutral-600 mt-0.5">{formatDuration(m.duration_seconds)}</p>
                      </div>
                    </div>
                  </DraggableMeetingRow>
                </div>
              )
            })}
          </div>
        )}
      </MeetingSelectionProvider>
    </>
  )
}
