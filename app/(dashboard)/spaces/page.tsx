import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import CreateSpaceModal from '@/components/CreateSpaceModal'
import SpaceCard from '@/components/SpaceCard'
import { getOrCreateDefaultSpace } from '@/lib/spaces'

export default async function SpacesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let owned: any[] = []
  let shared: any[] = []

  if (user?.email) {
    const { data: profile } = await service.from('profiles').select('id').eq('email', user.email).single()
    if (profile) {
      await getOrCreateDefaultSpace(service, profile.id)

      const [{ data: ownedSpaces }, { data: sharedRows }] = await Promise.all([
        service.from('spaces').select('id, name, emoji, created_at, is_default').eq('user_id', profile.id)
          .order('is_default', { ascending: false }).order('name'),
        service.from('space_shares').select('space_id, owner_id, spaces(id, name, emoji, created_at)').eq('shared_with_id', profile.id),
      ])
      owned = ownedSpaces ?? []

      const ownerIds = [...new Set((sharedRows ?? []).map((r: any) => r.owner_id))]
      const { data: owners } = ownerIds.length
        ? await service.from('profiles').select('id, name, email').in('id', ownerIds)
        : { data: [] }
      const ownerMap = new Map((owners ?? []).map((o: any) => [o.id, o.name ?? o.email]))

      shared = (sharedRows ?? [])
        .filter((r: any) => r.spaces)
        .map((r: any) => ({ ...r.spaces, ownerName: ownerMap.get(r.owner_id) ?? null }))
    }
  }

  // Conta reuniões por pasta
  const allIds = [...owned, ...shared].map(s => s.id)
  const counts = new Map<number, number>()
  if (allIds.length > 0) {
    const { data: meetingsBySpace } = await service.from('meetings').select('space_id').in('space_id', allIds).is('deleted_at', null)
    for (const m of meetingsBySpace ?? []) {
      counts.set(m.space_id, (counts.get(m.space_id) ?? 0) + 1)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Spaces</h1>
        <CreateSpaceModal />
      </div>

      {owned.length === 0 && shared.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
          <p className="text-sm text-neutral-500">Toda reunião vive em um space. Crie mais spaces para organizar por cliente, time ou projeto — e compartilhe com quem precisar acompanhar.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {owned.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Seus spaces</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {owned.map(s => (
                  <SpaceCard
                    key={s.id}
                    id={s.id}
                    href={`/spaces/${s.id}`}
                    emoji={s.emoji}
                    name={s.name}
                    isDefault={s.is_default}
                    meetingCount={counts.get(s.id) ?? 0}
                    canDelete={!s.is_default}
                  />
                ))}
              </div>
            </div>
          )}

          {shared.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Compartilhadas com você</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {shared.map(s => (
                  <SpaceCard
                    key={s.id}
                    id={s.id}
                    href={`/spaces/${s.id}`}
                    emoji={s.emoji}
                    name={s.name}
                    meetingCount={counts.get(s.id) ?? 0}
                    ownerName={s.ownerName}
                    canDelete={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
