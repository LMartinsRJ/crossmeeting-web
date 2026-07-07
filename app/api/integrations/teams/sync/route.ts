import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profileData } = await supabase.from('profiles').select('microsoft_calendar_token').eq('id', profile.id).maybeSingle()
  const token = (profileData as any)?.microsoft_calendar_token
  if (!token) return NextResponse.json({ error: 'Conta Microsoft não vinculada. Faça login com Microsoft para continuar.' }, { status: 400 })

  // Buscar reuniões online do usuário
  const meetingsRes = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings?$top=50&$orderby=startDateTime desc', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })

  if (meetingsRes.status === 401) {
    return NextResponse.json({ error: 'Token Microsoft expirado. Re-autorize a conta clicando em "Re-autorizar escopos".' }, { status: 401 })
  }
  if (meetingsRes.status === 403) {
    const body = await meetingsRes.json().catch(() => ({}))
    const code = body?.error?.code ?? ''
    if (code === 'Forbidden' || code === 'AccessDenied') {
      return NextResponse.json({
        error: 'Permissão insuficiente para acessar reuniões do Teams. Esta função requer uma conta Microsoft 365 organizacional. O administrador de TI precisa habilitar o escopo OnlineMeetings.Read para o seu domínio.',
      }, { status: 403 })
    }
  }
  if (!meetingsRes.ok) {
    const err = await meetingsRes.json().catch(() => ({}))
    return NextResponse.json({ error: err?.error?.message ?? 'Erro ao acessar Microsoft Graph API.' }, { status: meetingsRes.status })
  }

  const data = await meetingsRes.json()
  const meetings: any[] = data.value ?? []

  // Cursor de última sync
  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('last_synced_at')
    .eq('source', 'teams')
    .maybeSingle()

  const since = cred?.last_synced_at ? new Date(cred.last_synced_at) : new Date(0)

  const toImport = meetings.filter((m: any) => {
    const start = m.startDateTime ? new Date(m.startDateTime) : null
    return start && start > since
  })

  let imported = 0
  for (const m of toImport) {
    const subject = m.subject || 'Reunião Teams'
    const startDt = m.startDateTime ? new Date(m.startDateTime) : new Date()
    const endDt = m.endDateTime ? new Date(m.endDateTime) : startDt

    // Tentar buscar transcrição
    let transcript = ''
    if (m.id) {
      const tRes = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings/${m.id}/transcripts`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)

      if (tRes && tRes.ok) {
        const tData = await tRes.json().catch(() => ({}))
        const transcripts = tData.value ?? []
        if (transcripts.length > 0) {
          const contentRes = await fetch(
            `https://graph.microsoft.com/v1.0/me/onlineMeetings/${m.id}/transcripts/${transcripts[0].id}/content?$format=text/vtt`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => null)
          if (contentRes && contentRes.ok) {
            const vtt = await contentRes.text()
            transcript = vtt.replace(/WEBVTT\n\n/g, '').replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/g, '').trim()
          }
        }
      }
    }

    const durationSeconds = Math.round((endDt.getTime() - startDt.getTime()) / 1000)
    const participants = (m.participants?.attendees ?? []).map((a: any) => a.identity?.user?.displayName ?? a.upn ?? '').filter(Boolean)

    let enhancement = null
    if (transcript) {
      try {
        const msg = await anthropic.messages.create({
          model: process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analise esta transcrição de reunião do Microsoft Teams e retorne um JSON com: title (string), summary (string, 2-3 frases), key_points (array de strings), action_items (array de {text, owner?}), decisions (array de strings).\n\nTranscrição:\n${transcript.slice(0, 30000)}\n\nRetorne SOMENTE o JSON, sem markdown.`,
          }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        enhancement = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      } catch {}
    }

    const title = enhancement?.title ?? subject

    const { error } = await supabase.from('meetings').insert({
      user_id: profile.id,
      title,
      created_at: startDt.toISOString(),
      duration_seconds: durationSeconds,
      language: 'pt-BR',
      word_count: transcript.split(' ').filter(Boolean).length,
      transcript: transcript || null,
      enhancement: enhancement ? JSON.stringify(enhancement) : null,
      attendees: participants.length > 0 ? JSON.stringify(participants.map((p: string) => ({ name: p }))) : null,
      source: 'teams',
    })
    if (!error) imported++
  }

  // Atualizar cursor
  await supabase.from('integration_credentials').upsert({
    user_id: profile.id,
    source: 'teams',
    api_key: '',
    status: 'active',
    last_synced_at: new Date().toISOString(),
    synced_count: (cred ? 0 : 0) + imported,
  }, { onConflict: 'user_id,source' })

  return NextResponse.json({ imported, total: meetings.length, new_since_last_sync: toImport.length })
}
