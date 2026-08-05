import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ text: '' })

  const body = await req.json()
  const { firstName, todayMeetings, todayActions, overdueActions, todayEvents, dateLabel } = body

  try {
    const client = new Anthropic({ apiKey })

    const eventsText = (todayEvents ?? []).slice(0, 3)
      .map((e: any) => `- ${e.title} às ${new Date(e.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`)
      .join('\n') || 'Nenhum evento agendado para hoje.'

    const overdueText = (overdueActions ?? []).slice(0, 5)
      .map((a: any) => `- "${a.text}" (responsável: ${a.owner || 'não definido'}, venceu ${a.due_date})`)
      .join('\n') || 'Nenhuma ação em atraso.'

    const urgentText = (todayActions ?? []).slice(0, 5)
      .map((a: any) => `- "${a.text}" (responsável: ${a.owner || 'não definido'})`)
      .join('\n') || 'Nenhuma ação vence hoje.'

    const meetingsText = (todayMeetings ?? []).length > 0
      ? (todayMeetings as any[]).map((m: any) => `- ${m.title}`).join('\n')
      : 'Nenhuma reunião gravada hoje ainda.'

    const msg = await client.messages.create({
      model: process.env.CLAUDE_SONNET_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Você é um assistente executivo do Crossmeeting. Escreva um briefing matinal pessoal e direto para ${firstName}. Hoje é ${dateLabel}.

Agenda de hoje:
${eventsText}

Reuniões gravadas hoje:
${meetingsText}

Ações em atraso:
${overdueText}

Ações que vencem hoje:
${urgentText}

Escreva 3 parágrafos curtos (máx. 3 frases cada) em português brasileiro:
1. Contexto do dia (agenda + reuniões se houver)
2. Atenção imediata (atrasos e urgências — seja direto, cite nomes e tarefas)
3. Foco recomendado para hoje (3 prioridades concretas)

Use tom profissional mas direto, sem floreios. Não use bullet points. Não use saudação. Comece direto no contexto.`,
      }],
    })

    const content = msg.content[0]
    const text = content.type === 'text' ? content.text : ''
    return NextResponse.json({ text })
  } catch (err) {
    console.error('[briefing] Erro ao gerar briefing:', err)
    return NextResponse.json({ text: '' })
  }
}
