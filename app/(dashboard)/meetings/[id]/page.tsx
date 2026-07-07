import { createClient } from '@/lib/supabase/server'
import { parseAttendees, parseEnhancement } from '@/lib/parsers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ShareMeetingModal from '@/components/ShareMeetingModal'
import MoveToSpaceSelect from '@/components/MoveToSpaceSelect'
import MeetingTitleEditor from '@/components/MeetingTitleEditor'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ warn?: string }>
}) {
  const { id } = await params
  const { warn } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: m } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!m) notFound()

  // profiles_select_own policy: retorna o perfil do usuário autenticado
  const { data: myProfile } = await supabase.from('profiles').select('id').maybeSingle()
  const isOwner = !!myProfile && myProfile.id === m.user_id
  let ownerName: string | null = null
  if (!isOwner) {
    // Pode buscar nome do dono pois profiles tem policy SELECT para o próprio perfil;
    // aqui usamos o supabase session client que só retorna o próprio perfil.
    // O nome do dono não é crítico — não bloqueia a exibição.
    ownerName = null
  }

  const enhancement = parseEnhancement(m.enhancement)
  const attendees = parseAttendees(m.attendees)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/meetings" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors mb-6 inline-block">
        ← Todas as reuniões
      </Link>

      {warn === 'ai' && (
        <div className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
          <p className="text-xs text-amber-300 leading-relaxed">
            A análise com IA não foi concluída. A transcrição foi salva normalmente, mas o resumo e as ações não foram gerados.
            Você pode tentar reimportar a transcrição ou adicionar as ações manualmente.
          </p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-2">
        {isOwner
          ? <MeetingTitleEditor meetingId={m.id} title={m.title} />
          : <h1 className="text-2xl font-semibold text-white flex-1">{m.title}</h1>
        }
        {isOwner ? (
          <div className="flex items-center gap-2 shrink-0">
            <MoveToSpaceSelect meetingId={m.id} currentSpaceId={m.space_id ?? null} />
            <ShareMeetingModal meetingId={m.id} />
          </div>
        ) : ownerName ? (
          <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-lg shrink-0">
            Compartilhada por {ownerName}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-neutral-500 mb-8">
        {new Date(m.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        {' · '}{formatDuration(m.duration_seconds)}
        {m.word_count > 0 ? ` · ${m.word_count} palavras` : ''}
      </p>

      {/* Participantes */}
      {attendees.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Participantes</h2>
          <div className="flex flex-wrap gap-2">
            {attendees.map((a, i) => (
              <span key={i} className="text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-3 py-1 text-neutral-300">
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Enhancement */}
      {enhancement && (
        <div className="space-y-6 mb-8">
          {enhancement.summary && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Resumo</h2>
              <p className="text-sm text-neutral-300 leading-relaxed">{enhancement.summary}</p>
            </div>
          )}

          {enhancement.keyPoints?.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Pontos principais</h2>
              <ul className="space-y-1.5">
                {enhancement.keyPoints.map((kp: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                    <span className="text-[#6C8EFF] mt-0.5 shrink-0">·</span>
                    {kp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {enhancement.actionItems?.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Ações</h2>
              <ul className="space-y-2">
                {enhancement.actionItems.map((a: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                    <span className="w-4 h-4 rounded border border-white/20 shrink-0 mt-0.5" />
                    <span>
                      {a.text}
                      {a.owner && <span className="text-neutral-600"> · {a.owner}</span>}
                      {a.due && <span className="text-neutral-600"> · {a.due}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {enhancement.decisions?.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Decisões</h2>
              <ul className="space-y-1.5">
                {enhancement.decisions.map((d: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    {d.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Transcrição */}
      {m.transcript && (
        <div>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Transcrição</h2>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {m.transcript}
          </div>
        </div>
      )}
    </div>
  )
}
