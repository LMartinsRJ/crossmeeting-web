'use client'

import { usePathname } from 'next/navigation'

export default function ScrollContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const noScroll = pathname === '/agenda'

  if (noScroll) return <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
  return <div className="flex-1 overflow-y-auto">{children}</div>
}
