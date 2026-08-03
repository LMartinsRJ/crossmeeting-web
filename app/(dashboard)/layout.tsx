import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { DragProvider } from '@/components/DragStore'
import { getOrgContext } from '@/lib/enterprise'
import { isSuperAdmin } from '@/lib/superAdmin'
import CalendarSyncTrigger from '@/components/CalendarSyncTrigger'
import ScrollContainer from '@/components/ScrollContainer'
import { LanguageProvider } from '@/components/LanguageContext'
import type { Lang } from '@/lib/strings'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [orgContext, superAdmin, profileData] = await Promise.all([
    getOrgContext(),
    isSuperAdmin(),
    supabase.from('profiles').select('ui_language').maybeSingle(),
  ])

  const uiLang = ((profileData.data as any)?.ui_language ?? 'pt') as Lang

  return (
    <LanguageProvider initial={uiLang}>
      <DragProvider>
        <div className="flex h-screen overflow-hidden bg-[#0E1117]">
          <Sidebar user={user} orgContext={orgContext} superAdmin={superAdmin} />
          <main className="flex-1 overflow-hidden flex flex-col">
            <CalendarSyncTrigger />
            <ScrollContainer>{children}</ScrollContainer>
          </main>
        </div>
      </DragProvider>
    </LanguageProvider>
  )
}
