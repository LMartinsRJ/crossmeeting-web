import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { DragProvider } from '@/components/DragStore'
import { getOrgContext } from '@/lib/enterprise'
import { isSuperAdmin } from '@/lib/superAdmin'
import CalendarSyncTrigger from '@/components/CalendarSyncTrigger'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [orgContext, superAdmin] = await Promise.all([
    getOrgContext(),
    isSuperAdmin(),
  ])

  return (
    <DragProvider>
      <div className="flex h-screen overflow-hidden bg-[#0E1117]">
        <Sidebar user={user} orgContext={orgContext} superAdmin={superAdmin} />
        <main className="flex-1 overflow-y-auto">
          <CalendarSyncTrigger />
          {children}
        </main>
      </div>
    </DragProvider>
  )
}
