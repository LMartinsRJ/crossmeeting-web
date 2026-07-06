'use client'

import { useEffect } from 'react'

const DEBOUNCE_KEY = 'calendar_sync_last'
const MIN_INTERVAL_MS = 5 * 60 * 1000 // 5 min

export default function CalendarSyncTrigger() {
  useEffect(() => {
    const last = sessionStorage.getItem(DEBOUNCE_KEY)
    if (last && Date.now() - Number(last) < MIN_INTERVAL_MS) return

    sessionStorage.setItem(DEBOUNCE_KEY, String(Date.now()))

    fetch('/api/sync-calendar', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'token_expired') {
          console.warn('[CalendarSync] token expirado — faça login novamente para reativar a agenda.')
        }
      })
      .catch(() => { /* silencioso — sync de calendário não bloqueia o briefing */ })
  }, [])

  return null
}
