import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profileData } = await supabase.from('profiles').select('google_calendar_token').eq('id', profile.id).maybeSingle()
  const token = (profileData as any)?.google_calendar_token
  if (!token) return NextResponse.json({ error: 'Conta Google não vinculada.' }, { status: 400 })

  // Buscar arquivos de transcrição do Meet no Drive
  // Meet salva arquivos do tipo "Google Docs" com nome contendo "Transcrição" ou "Transcript"
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.document' and (name contains 'Transcrição' or name contains 'Transcript' or name contains 'Meet') and trashed=false"
  )
  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,modifiedTime)&orderBy=createdTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (driveRes.status === 401) {
    return NextResponse.json({ error: 'Token Google expirado. Re-autorize clicando em "Re-autorizar Drive".' }, { status: 401 })
  }
  if (driveRes.status === 403) {
    return NextResponse.json({
      error: 'Permissão de leitura do Drive não concedida. Clique em "Re-autorizar Drive" para adicionar o acesso ao Google Drive.',
    }, { status: 403 })
  }
  if (!driveRes.ok) {
    const err = await driveRes.json().catch(() => ({}))
    return NextResponse.json({ error: err?.error?.message ?? 'Erro ao acessar Google Drive.' }, { status: driveRes.status })
  }

  const driveData = await driveRes.json()
  const files: any[] = driveData.files ?? []

  // Cursor de última sync
  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('last_synced_at, synced_count')
    .eq('source', 'google_meet')
    .maybeSingle()

  const since = cred?.last_synced_at ? new Date(cred.last_synced_at) : new Date(0)
  const toImport = files.filter((f: any) => new Date(f.createdTime) > since)

  let imported = 0
  for (const file of toImport) {
    // Exportar conteúdo como texto puro
    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(() => null)

    if (!contentRes || !contentRes.ok) continue
    const transcript = (await contentRes.text()).trim()
    if (!transcript || transcript.length < 50) continue

    const startDt = new Date(file.createdTime)

    let enhancement = null
    try {
      const msg = await anthropic.messages.create({
        model: process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analise esta transcrição de reunião do Google Meet e retorne um JSON com: title (string), summary (string, 2-3 frases), key_points (array de strings), action_items (array de {text, owner?}), decisions (array de strings).\n\nTranscrição:\n${transcript.slice(0, 30000)}\n\nRetorne SOMENTE o JSON, sem markdown.`,
        }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      enhancement = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    } catch {}

    const title = enhancement?.title ?? file.name ?? 'Reunião Google Meet'

    const { error } = await supabase.from('meetings').insert({
      user_id: profile.id,
      title,
      created_at: startDt.toISOString(),
      duration_seconds: 0,
      language: 'pt-BR',
      word_count: transcript.split(' ').filter(Boolean).length,
      transcript,
      enhancement: enhancement ? JSON.stringify(enhancement) : null,
      source: 'google_meet',
    })
    if (!error) imported++
  }

  const prevCount = cred?.synced_count ?? 0
  await supabase.from('integration_credentials').upsert({
    user_id: profile.id,
    source: 'google_meet',
    api_key: '',
    status: 'active',
    last_synced_at: new Date().toISOString(),
    synced_count: prevCount + imported,
  }, { onConflict: 'user_id,source' })

  return NextResponse.json({ imported, total: files.length, new_since_last_sync: toImport.length })
}
