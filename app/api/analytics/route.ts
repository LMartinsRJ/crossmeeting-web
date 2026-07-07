import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const { supabase, profile } = await getAuthContext()
  if (!profile) return unauthorized()

  const { from, to } = await req.json()
  if (!from || !to) return NextResponse.json({ error: 'from e to obrigatórios.' }, { status: 400 })

  const toEnd = new Date(to)
  toEnd.setDate(toEnd.getDate() + 1)

  const [{ data: meetings }, { data: actions }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, created_at, duration_seconds, word_count, enhancement, attendees')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .gte('created_at', new Date(from).toISOString())
      .lt('created_at', toEnd.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('action_items')
      .select('id, text, status, due_date, owner, created_at')
      .eq('user_id', profile.id)
      .gte('created_at', new Date(from).toISOString())
      .lt('created_at', toEnd.toISOString()),
  ])

  const list = meetings ?? []
  const actionList = actions ?? []

  // --- Métricas calculadas ---
  const totalSecs = list.reduce((s, m) => s + (m.duration_seconds ?? 0), 0)
  const totalHours = totalSecs / 3600

  // Reuniões por dia da semana
  const byWeekday = [0, 0, 0, 0, 0, 0, 0]
  for (const m of list) {
    const day = new Date(m.created_at).getDay()
    byWeekday[day]++
  }

  // Reuniões por semana
  const byWeek: Record<string, number> = {}
  for (const m of list) {
    const d = new Date(m.created_at)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    byWeek[key] = (byWeek[key] ?? 0) + 1
  }

  // Participantes frequentes
  const participantMap: Record<string, number> = {}
  for (const m of list) {
    const attendees = Array.isArray(m.attendees) ? m.attendees : []
    for (const a of attendees) {
      const name = a?.name ?? a
      if (name) participantMap[name] = (participantMap[name] ?? 0) + 1
    }
  }
  const topParticipants = Object.entries(participantMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  // Ações por status
  const actionsByStatus = { pending: 0, in_progress: 0, done: 0 }
  for (const a of actionList) {
    const s = a.status as keyof typeof actionsByStatus
    if (s in actionsByStatus) actionsByStatus[s]++
  }

  // Contexto para Claude
  const summaries = list.slice(0, 30).map(m => ({
    title: m.title,
    date: m.created_at.slice(0, 10),
    duration_min: Math.round((m.duration_seconds ?? 0) / 60),
    summary: (m.enhancement as any)?.summary ?? null,
    keyPoints: (m.enhancement as any)?.keyPoints?.slice(0, 3) ?? [],
  }))

  // Gera análise com Claude
  let analysis = ''
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const model = process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6'

    const prompt = `Analise os dados de reuniões do período ${from} a ${to} e gere um relatório executivo em português brasileiro.

DADOS:
- Total de reuniões: ${list.length}
- Horas em reuniões: ${totalHours.toFixed(1)}h
- Reuniões por dia da semana (Dom-Sáb): ${byWeekday.join(', ')}
- Ações criadas no período: ${actionList.length} (${actionsByStatus.pending} pendentes, ${actionsByStatus.in_progress} em andamento, ${actionsByStatus.done} concluídas)
- Top participantes: ${topParticipants.map(p => `${p.name} (${p.count} reuniões)`).join(', ') || 'nenhum'}

RESUMOS DAS REUNIÕES:
${summaries.map(s => `[${s.date}] ${s.title} (${s.duration_min}min)${s.summary ? ': ' + s.summary : ''}`).join('\n')}

Gere um JSON com esta estrutura exata (sem markdown):
{
  "headline": "frase curta capturando o padrão principal do período",
  "paragraphs": ["parágrafo 1 sobre volume e padrões", "parágrafo 2 sobre participação e colaboração", "parágrafo 3 sobre ações e produtividade"],
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4"],
  "recommendations": ["recomendação 1", "recomendação 2", "recomendação 3"]
}`

    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = ((msg.content[0] as any).text ?? '').trim()
    JSON.parse(text) // valida
    analysis = text
  } catch {
    analysis = JSON.stringify({
      headline: 'Análise indisponível',
      paragraphs: ['Não foi possível gerar a análise com IA neste momento.'],
      insights: [],
      recommendations: [],
    })
  }

  return NextResponse.json({
    period: { from, to },
    meeting_count: list.length,
    total_hours: Math.round(totalHours * 10) / 10,
    avg_duration_min: list.length ? Math.round(totalSecs / list.length / 60) : 0,
    by_weekday: byWeekday,
    by_week: byWeek,
    top_participants: topParticipants,
    actions: actionsByStatus,
    action_total: actionList.length,
    analysis: JSON.parse(analysis),
  })
}
