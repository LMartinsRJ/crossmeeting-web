import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from 'next/link'
import CreateSpaceModal from '@/components/CreateSpaceModal'

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
      const [{ data: ownedSpaces }, { data: sharedRows }] = await Promise.all([
        service.from('spaces').select('id, name, emoji, created_at').eq('user_id', profile.id).order('name'),
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
    const { data: meetingsBySpace } = await service.from('meetings').select('space_id').in('space_id', allIds)
    for (const m of meetingsBySpace ?? []) {
      counts.set(m.space_id, (counts.get(m.space_id) ?? 0) + 1)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Pastas</h1>
        <CreateSpaceModal />
      </div>

      {owned.length === 0 && shared.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
          <p className="text-sm text-neutral-500">Crie pastas para organizar suas reuniões por cliente, time ou projeto — e compartilhe com quem precisar acompanhar.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {owned.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Suas pastas</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {owned.map(s => (
                  <Link key={s.id} href={`/spaces/${s.id}`} className="bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-4 transition-colors">
                    <span className="text-2xl">{s.emoji}</span>
                    <p className="text-sm font-medium text-white mt-2 truncate">{s.name}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">{counts.get(s.id) ?? 0} reuniões</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {shared.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Compartilhadas com você</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {shared.map(s => (
                  <Link key={s.id} href={`/spaces/${s.id}`} className="bg-white/[0.03] border border-purple-500/15 hover:border-purple-500/30 rounded-2xl p-4 transition-colors">
                    <span className="text-2xl">{s.emoji}</span>
                    <p className="text-sm font-medium text-white mt-2 truncate">{s.name}</p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {counts.get(s.id) ?? 0} reuniões{s.ownerName ? ` · de ${s.ownerName}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
