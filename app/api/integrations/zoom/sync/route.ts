import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getZoomToken(clientId: string, clientSecret: string, accountId: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
  )
  if (!res.ok) throw new Error('Falha ao obter token Zoom')
  const data = await res.json()
  return data.access_token
}

export async function POST() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('api_key, last_synced_at, synced_count')
    .eq('source', 'zoom')
    .maybeSingle()

  if (!cred?.api_key) return NextResponse.json({ error: 'Zoom não conectado.' }, { status: 400 })

  let parsed: { account_id: string; client_id: string; client_secret: string }
  try {
    parsed = JSON.parse(cred.api_key)
  } catch {
    return NextResponse.json({ error: 'Credenciais Zoom inválidas. Reconecte o Zoom.' }, { status: 400 })
  }

  let token: string
  try {
    token = await getZoomToken(parsed.client_id, parsed.client_secret, parsed.account_id)
  } catch {
    return NextResponse.json({ error: 'Falha ao autenticar com Zoom. Verifique as credenciais.' }, { status: 401 })
  }

  // Buscar gravações do último ano
  const from = cred.last_synced_at
    ? new Date(cred.last_synced_at).toISOString().split('T')[0]
    : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = new Date().toISOString().split('T')[0]

  const recRes = await fetch(
    `https://api.zoom.us/v2/users/me/recordings?from=${from}&to=${to}&page_size=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!recRes.ok) {
    const err = await recRes.json().catch(() => ({}))
    return NextResponse.json({ error: err?.message ?? 'Erro ao acessar gravações Zoom.' }, { status: recRes.status })
  }

  const recData = await recRes.json()
  const meetings: any[] = recData.meetings ?? []

  let imported = 0
  for (const meeting of meetings) {
    const startDt = new Date(meeting.start_time)
    const durationSeconds = (meeting.duration ?? 0) * 60

    // Buscar arquivo VTT de transcrição
    const files: any[] = meeting.recording_files ?? []
    const vttFile = files.find((f: any) => f.file_type === 'TRANSCRIPT' || f.file_extension === 'VTT')

    let transcript = ''
    if (vttFile?.download_url) {
      const vttRes = await fetch(`${vttFile.download_url}?access_token=${token}`).catch(() => null)
      if (vttRes && vttRes.ok) {
        const vtt = await vttRes.text()
        transcript = vtt
          .replace(/WEBVTT\n\n/g, '')
          .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}(\s[^\n]*)?\n/g, '')
          .replace(/^\d+\n/gm, '')
          .trim()
      }
    }

    const participants = (meeting.participants_count ?? 0)

    let enhancement = null
    if (transcript) {
      try {
        const msg = await anthropic.messages.create({
          model: process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analise esta transcrição de reunião do Zoom e retorne um JSON com: title (string), summary (string, 2-3 frases), key_points (array de strings), action_items (array de {text, owner?}), decisions (array de strings).\n\nTranscrição:\n${transcript.slice(0, 30000)}\n\nRetorne SOMENTE o JSON, sem markdown.`,
          }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        enhancement = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      } catch {}
    }

    const title = enhancement?.title ?? meeting.topic ?? 'Reunião Zoom'

    const { error } = await supabase.from('meetings').insert({
      user_id: profile.id,
      title,
      created_at: startDt.toISOString(),
      duration_seconds: durationSeconds,
      language: 'pt-BR',
      word_count: transcript.split(' ').filter(Boolean).length,
      transcript: transcript || null,
      enhancement: enhancement ? JSON.stringify(enhancement) : null,
      source: 'zoom',
    })
    if (!error) imported++
  }

  const prevCount = cred?.synced_count ?? 0
  await supabase.from('integration_credentials').update({
    last_synced_at: new Date().toISOString(),
    synced_count: prevCount + imported,
    status: 'active',
  }).eq('user_id', profile.id).eq('source', 'zoom')

  return NextResponse.json({ imported, total: meetings.length })
}
