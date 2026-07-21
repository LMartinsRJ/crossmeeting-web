/**
 * Score de Atenção 0-100 — portado de attention_score_service.py (projeto enterprise)
 *
 * Fatores:
 *   35 pts — urgência do prazo
 *   20 pts — prioridade declarada
 *   20 pts — tempo sem atualização
 *   15 pts — taxa de atraso histórico da área
 *   10 pts — reservado para recorrência semântica (embeddings, futuro)
 */

const PRIO_PTS: Record<string, number> = {
  critica: 20,
  alta: 15,
  media: 10,
  baixa: 5,
}

function prazoPts(dueDate: string | null): { pts: number; reason: string } {
  if (!dueDate) return { pts: 0, reason: '' }
  const prazo = new Date(dueDate + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dias = Math.round((prazo.getTime() - today.getTime()) / 86400000)
  if (dias < 0) return { pts: 35, reason: `Vencida há ${Math.abs(dias)}d` }
  if (dias === 0) return { pts: 30, reason: 'Vence hoje' }
  if (dias <= 2) return { pts: 25, reason: `Vence em ${dias}d` }
  if (dias <= 7) return { pts: 15, reason: `Vence em ${dias}d` }
  if (dias <= 14) return { pts: 8, reason: `Prazo em ${dias}d` }
  return { pts: 3, reason: '' }
}

function stalePts(updatedAt: string | null): { pts: number; reason: string } {
  if (!updatedAt) return { pts: 10, reason: 'Sem registro de atualização' }
  const updated = new Date(updatedAt)
  const dias = Math.floor((Date.now() - updated.getTime()) / 86400000)
  if (dias > 30) return { pts: 20, reason: `Sem atualização há ${dias}d` }
  if (dias > 14) return { pts: 15, reason: `Sem atualização há ${dias}d` }
  if (dias > 7)  return { pts: 10, reason: `Sem atualização há ${dias}d` }
  if (dias > 3)  return { pts: 5,  reason: `Atualizada há ${dias}d` }
  return { pts: 0, reason: '' }
}

export interface ActionInput {
  id: number | string
  user_id?: string
  text: string
  due_date: string | null
  done_at: string | null
  status: string | null
  prioridade: string | null
  area: string | null
  updated_at: string | null
  [key: string]: unknown
}

export interface ScoredAction extends ActionInput {
  attention_score: number
  score_reasons: string[]
}

/**
 * Calcula o score para uma lista de ações.
 * areaOverdueRates: mapa de area → fração de ações vencidas (0-1), calculado previamente.
 */
export function scoreActions(
  actions: ActionInput[],
  areaOverdueRates: Record<string, number> = {}
): ScoredAction[] {
  const today = new Date().toISOString().split('T')[0]

  const open = actions.filter(a => !a.done_at && a.status !== 'done')

  const scored: ScoredAction[] = open.map(a => {
    let score = 0
    const reasons: string[] = []

    // 1. Urgência do prazo (0-35)
    const { pts: prazoPt, reason: prazoR } = prazoPts(a.due_date)
    score += prazoPt
    if (prazoR) reasons.push(prazoR)

    // 2. Prioridade declarada (0-20)
    score += PRIO_PTS[a.prioridade?.toLowerCase() ?? 'media'] ?? 10

    // 3. Tempo sem atualização (0-20)
    const { pts: stalePt, reason: staleR } = stalePts(a.updated_at)
    score += stalePt
    if (staleR) reasons.push(staleR)

    // 4. Taxa de atraso da área (0-15)
    const pct = areaOverdueRates[a.area ?? ''] ?? 0
    const areaPts = Math.round(pct * 15)
    score += areaPts
    if (areaPts >= 8) reasons.push(`Área com ${Math.round(pct * 100)}% de atraso`)

    // 5. Recorrência semântica — reservado (embeddings futuros)

    return {
      ...a,
      attention_score: Math.min(score, 100),
      score_reasons: reasons,
    }
  })

  scored.sort((a, b) => b.attention_score - a.attention_score)
  return scored
}

/** Pré-calcula a taxa de atraso por área a partir de uma lista de ações */
export function buildAreaOverdueRates(actions: ActionInput[]): Record<string, number> {
  const today = new Date().toISOString().split('T')[0]
  const totals: Record<string, number> = {}
  const overdue: Record<string, number> = {}

  for (const a of actions) {
    const area = a.area ?? ''
    if (!a.due_date) continue
    totals[area] = (totals[area] ?? 0) + 1
    if (!a.done_at && a.status !== 'done' && a.due_date < today) {
      overdue[area] = (overdue[area] ?? 0) + 1
    }
  }

  const rates: Record<string, number> = {}
  for (const area of Object.keys(totals)) {
    rates[area] = Math.min((overdue[area] ?? 0) / totals[area], 1)
  }
  return rates
}

/** Converte score numérico em label + cor Tailwind */
export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Crítico',  color: 'text-red-400'    }
  if (score >= 45) return { label: 'Alto',     color: 'text-orange-400' }
  if (score >= 25) return { label: 'Médio',    color: 'text-yellow-400' }
  return              { label: 'Baixo',    color: 'text-green-400'  }
}
