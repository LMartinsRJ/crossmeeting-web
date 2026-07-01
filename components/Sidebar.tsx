'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',        icon: '◧' },
  { href: '/briefing',   label: 'Briefing do dia',  icon: '◈' },
  { href: '/actions',    label: 'Ações',             icon: '✅' },
  { href: '/meetings',   label: 'Reuniões',          icon: '◷' },
  { href: '/spaces',     label: 'Spaces',            icon: '📁' },
  { href: '/people',     label: 'Pessoas',           icon: '◉' },
  { href: '/companies',  label: 'Empresas',          icon: '◫' },
]

const SHARES_SEEN_KEY = 'cm_shares_seen_at'

const NAV2 = [
  { href: '/trash',      label: 'Lixeira',          icon: '🗑' },
  { href: '/settings',   label: 'Configurações',    icon: '◎' },
]

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [unseenShares, setUnseenShares] = useState(0)

  const initials = (user.user_metadata?.full_name as string ?? user.email ?? '?')
    .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    fetch('/api/shares/summary').then(r => r.json()).then(data => {
      const seenAt = Number(localStorage.getItem(SHARES_SEEN_KEY) ?? 0)
      const unseen = (data.timestamps ?? []).filter((t: string) => new Date(t).getTime() > seenAt)
      setUnseenShares(unseen.length)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (pathname === '/spaces' || pathname.startsWith('/spaces/') || pathname === '/meetings') {
      localStorage.setItem(SHARES_SEEN_KEY, String(Date.now()))
      setUnseenShares(0)
    }
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-52 shrink-0 flex flex-col h-full bg-[#13161D] border-r border-white/[0.05]">

      {/* Logo */}
      <div className="px-5 h-14 flex items-center gap-2.5 shrink-0">
        <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
          <rect x="0"  y="10" width="3" height="10" rx="1.5" fill="#6C8EFF"/>
          <rect x="4"  y="4"  width="3" height="16" rx="1.5" fill="#6C8EFF"/>
          <rect x="8"  y="0"  width="3" height="20" rx="1.5" fill="#6C8EFF"/>
          <rect x="12" y="6"  width="3" height="14" rx="1.5" fill="#6C8EFF"/>
          <rect x="16" y="12" width="2" height="8"  rx="1"   fill="#6C8EFF" opacity="0.6"/>
        </svg>
        <span className="text-[13px] font-bold tracking-[0.02em] text-white">
          <span className="text-[#6C8EFF]">CROSS</span>MEETING
        </span>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              pathname === item.href
                ? 'bg-[#6C8EFF]/15 text-[#6C8EFF]'
                : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <span className="flex-1">{item.label}</span>
            {item.href === '/spaces' && unseenShares > 0 && (
              <span className="text-[10px] bg-[#6C8EFF] text-white font-semibold px-1.5 py-0.5 rounded-full">{unseenShares}</span>
            )}
          </Link>
        ))}

        <div className="pt-4 pb-1 px-3">
          <span className="text-[10px] font-semibold text-neutral-700 uppercase tracking-widest">Sistema</span>
        </div>

        {NAV2.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
              pathname === item.href
                ? 'bg-[#6C8EFF]/15 text-[#6C8EFF]'
                : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-3 py-3 border-t border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-6 h-6 rounded-full bg-[#6C8EFF] flex items-center justify-center text-[10px] font-semibold text-white shrink-0 overflow-hidden">
            {user.user_metadata?.avatar_url
              ? <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="" />
              : initials
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-300 truncate">
              {user.user_metadata?.full_name ?? user.email}
            </p>
            <p className="text-[10px] text-neutral-600 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-neutral-700 hover:text-neutral-400 transition-colors text-[10px]"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
