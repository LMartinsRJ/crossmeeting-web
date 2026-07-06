import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Busca eventos do Google Calendar (próximos 7 dias)
async function fetchGoogleEvents(token: string) {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', now.toISOString())
  url.searchParams.set('timeMax', in7Days.toISOString())
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('maxResults', '20')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) return { events: null, expired: true }
  if (!res.ok) return { events: null, expired: false }

  const data = await res.json()
  return { events: data.items ?? [], expired: false }
}

// Busca eventos do Microsoft Calendar (próximos 7 dias)
async function fetchMicrosoftEvents(token: string) {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
  url.searchParams.set('startDateTime', now.toISOString())
  url.searchParams.set('endDateTime', in7Days.toISOString())
  url.searchParams.set('$orderby', 'start/dateTime')
  url.searchParams.set('$top', '20')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) return { events: null, expired: true }
  if (!res.ok) return { events: null, expired: false }

  const data = await res.json()
  return { events: data.value ?? [], expired: false }
}

// Extrai link de reunião de um evento Google
function extractGoogleMeetingLink(item: any): string | null {
  if (item.hangoutLink) return item.hangoutLink
  const loc = item.location ?? ''
  const desc = item.description ?? ''
  const match = (loc + ' ' + desc).match(/https?:\/\/[^\s"<>]*(zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com)[^\s"<>]*/i)
  return match ? match[0] : null
}

// Extrai link de reunião de um evento Microsoft
function extractMicrosoftMeetingLink(item: any): string | null {
  if (item.onlineMeeting?.joinUrl) return item.onlineMeeting.joinUrl
  const loc = item.location?.displayName ?? ''
  const body = item.body?.content ?? ''
  const match = (loc + ' ' + body).match(/https?:\/\/[^\s"<>]*(zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com)[^\s"<>]*/i)
  return match ? match[0] : null
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const service = getService()
  const { data: profile } = await service
    .from('profiles')
    .select('id, calendar_provider, google_calendar_token, microsoft_calendar_token')
    .eq('email', user.email)
    .single()

  if (!profile?.id) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  const provider = profile.calendar_provider
  const token = provider === 'google'
    ? profile.google_calendar_token
    : profile.microsoft_calendar_token

  if (!token) {
    return NextResponse.json({ status: 'no_token', message: 'Faça login novamente para conectar o calendário.' })
  }

  // Busca eventos do provedor
  const result = provider === 'google'
    ? await fetchGoogleEvents(token)
    : await fetchMicrosoftEvents(token)

  if (result.expired) {
    return NextResponse.json({ status: 'token_expired', message: 'Token de calendário expirado. Faça login novamente.' })
  }
  if (!result.events) {
    return NextResponse.json({ status: 'error', message: 'Erro ao buscar eventos do calendário.' })
  }

  const events = result.events
  if (events.length === 0) return NextResponse.json({ status: 'ok', synced: 0 })

  // Normaliza e faz upsert na tabela calendar_events
  const rows = events.map((item: any) => {
    if (provider === 'google') {
      const startAt = item.start?.dateTime ?? item.start?.date
      const endAt = item.end?.dateTime ?? item.end?.date
      const attendees = (item.attendees ?? []).map((a: any) => ({ name: a.displayName ?? a.email, email: a.email }))
      return {
        id: item.id,
        user_id: profile.id,
        title: item.summary ?? '(sem título)',
        start_at: startAt,
        end_at: endAt,
        meeting_link: extractGoogleMeetingLink(item),
        attendees: attendees.length > 0 ? JSON.stringify(attendees) : null,
        provider: 'google',
        recurring_event_id: item.recurringEventId ?? null,
        updated_at: new Date().toISOString(),
      }
    } else {
      const startAt = item.start?.dateTime
      const endAt = item.end?.dateTime
      const attendees = (item.attendees ?? []).map((a: any) => ({ name: a.emailAddress?.name ?? a.emailAddress?.address, email: a.emailAddress?.address }))
      return {
        id: item.id,
        user_id: profile.id,
        title: item.subject ?? '(sem título)',
        start_at: startAt,
        end_at: endAt,
        meeting_link: extractMicrosoftMeetingLink(item),
        attendees: attendees.length > 0 ? JSON.stringify(attendees) : null,
        provider: 'microsoft',
        recurring_event_id: item.seriesMasterId ?? null,
        updated_at: new Date().toISOString(),
      }
    }
  }).filter((r: any) => r.start_at && r.end_at)

  const { error } = await service
    .from('calendar_events')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    console.error('[sync-calendar] upsert error:', error.message)
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok', synced: rows.length })
}
