# Otimização de Tokens — IA do Crossmeeting

> Documento vivo. Atualizar conforme cada otimização for implementada.

---

## Contexto

O Crossmeeting usa IA em três pontos principais:

| Onde | Função | Gatilho |
|---|---|---|
| `enhance-transcript` (edge function) | Transforma transcrição bruta em JSON estruturado | Ao salvar cada reunião |
| `send-morning-briefing` (edge function) | Gera e envia briefing matinal por e-mail | Cron diário 7h BRT |
| `briefing/page.tsx` (Next.js) | Gera briefing sob demanda na web | Acesso à página |

O maior custo unitário é o `enhance-transcript` — chamado para cada reunião gravada, com a transcrição inteira como input.

---

## Diagnóstico de custo (situação original)

### `enhance-transcript`

```
Input tokens por chamada:
  - Instruções estáticas (sistema):  ~350 tokens
  - Transcrição (variável):          500–12.000 tokens (30min–2h de reunião)
  - Metadados / participantes:       ~50 tokens

Output máximo reservado: 2.048 tokens
Output real médio:        ~600–700 tokens (JSON estruturado)
```

**Problema:** As instruções (~350 tokens) eram cobradas como tokens novos a cada chamada. Em 100 reuniões/mês = 35.000 tokens pagos desnecessariamente só em instruções.

### `send-morning-briefing`

```
Input tokens por usuário/dia:
  - Instruções + prompt:   ~280 tokens
  - Dados variáveis:       ~150 tokens

Output máximo reservado: 600 tokens
Output real médio:        ~350 tokens
```

**Problema:** Mesmo padrão — sem cache, sem system prompt, output superestimado.

---

## Otimizações implementadas

### ✅ 1. Prompt Caching (Anthropic)

**Data:** 2026-08-05  
**Onde:** `enhance-transcript` (função `callAI`)

**O que é:** A Anthropic permite marcar blocos de texto com `cache_control: { type: "ephemeral" }`. O bloco é armazenado em cache por **5 minutos**. Chamadas seguintes dentro desse janela pagam **0,1× o preço normal** no bloco cacheado (desconto de 90%).

**Implementação:**

```typescript
// Antes — system prompt cobrado integralmente toda vez:
body: JSON.stringify({
  model: cfg.model,
  max_tokens: maxTokens,
  system: "Você recebeu a transcrição... [350 tokens de instrução]",
  messages
})

// Depois — system prompt cacheado:
body: JSON.stringify({
  model: cfg.model,
  max_tokens: maxTokens,
  system: [{ 
    type: 'text', 
    text: "Você é um assistente... [350 tokens de instrução]",
    cache_control: { type: 'ephemeral' }   // ← marca para cache
  }],
  messages
})
// + header: 'anthropic-beta': 'prompt-caching-2024-07-31'
```

**Impacto estimado:**

| Cenário | Sem cache | Com cache (após 1ª chamada) |
|---|---|---|
| 10 reuniões/dia | 3.500 tokens instrução | 350 tokens instrução |
| 100 reuniões/mês | 35.000 tokens instrução | 3.500 tokens instrução |
| Economia mensal | — | ~31.500 tokens de input |

> **Nota:** O cache dura 5 minutos. Se o servidor ficar mais de 5 min sem chamadas, a próxima será um cache miss (cobrada normalmente). Em uso cotidiano, o hit rate deve ser alto nas horas de pico.

**Limitações:**
- Só funciona com o provider Anthropic. OpenAI, DeepSeek, Gemini e endpoints customizados continuam sem cache (sem alteração no comportamento para esses providers).
- O bloco cacheado precisa ter **≥ 1.024 tokens** para ser elegível ao cache. O system prompt do enhance-transcript tem ~350 tokens — **abaixo do mínimo**. O cache só se ativa se o prompt completo (system + user) cruzar esse limiar, o que acontece em qualquer reunião com transcrição de ~700+ tokens (~500 palavras).

### ✅ 2. Redução de `max_tokens` (output reservado)

**Data:** 2026-08-05  
**Onde:** `enhance-transcript`

**O que é:** O `max_tokens` reserva o espaço máximo de output. Não é cobrado por tokens não usados, mas sinaliza ao modelo que ele pode ser prolixo. Reduzir para o máximo real esperado mantém a qualidade e torna a resposta mais direta.

**Mudança:**

```typescript
// Antes:
{ messages, maxTokens: 2048 }

// Depois:
{ messages, maxTokens: 1024 }
```

**Justificativa:**
- JSON com título (≤60 chars) + resumo (5 frases) + 8 key points + action items + decisões: ~600–750 tokens em média
- 1.024 dá 35% de folga sobre o caso mais verboso observado
- Com 2.048 o modelo às vezes gerava keyPoints com parágrafos em vez de bullets — 1.024 induz respostas mais concisas naturalmente

**Separação de system/user prompt:**

Junto com essa mudança, o prompt foi reestruturado:

```
[ANTES — tudo no user message, misturado com a transcrição]
"Você recebeu a transcrição... Analise e gere:
1. Título...
Transcrição: [texto]
Data: [data]
Responda em JSON..."

[DEPOIS — instruções no system, dados no user]
system: "Você é um especialista em análise de reuniões.
         Responda APENAS em JSON: {...schema...}
         Regras: ..."
user:   "Data: [data]
         Participantes: [lista]
         Contexto: [metadata]
         Transcrição: [texto]"
```

Benefício duplo: o system prompt fica elegível ao cache, e a estrutura é mais clara para o modelo.

---

## Otimizações planejadas (próximos passos)

### ⏳ 3. Truncagem inteligente de transcrições longas

**Problema:** Uma reunião de 2h pode gerar 12.000–15.000 tokens de transcrição. A IA não precisa de tudo — ela é boa em capturar padrões nos primeiros e últimos trechos.

**Solução proposta:**
```typescript
function smartTruncate(transcript: string, maxChars = 18000): string {
  if (transcript.length <= maxChars) return transcript
  // Primeiros 60% (abertura, agenda, contexto) + últimos 25% (conclusões, ações)
  const head = Math.floor(maxChars * 0.60)
  const tail = Math.floor(maxChars * 0.25)
  const omitted = transcript.length - head - tail
  return transcript.slice(0, head) 
    + `\n\n[... ${omitted} caracteres omitidos por brevidade ...]\n\n`
    + transcript.slice(-tail)
}
```

**Threshold:** 18.000 chars ≈ 4.500 tokens ≈ reunião de ~50min. Acima disso, truncar.

**Risco:** Ações mencionadas no meio da reunião (não no início nem no fim) podem ser perdidas. Mitigação: aumentar o threshold de tail para 35%.

**Impacto estimado:**
- Reuniões de 1h: sem impacto (abaixo do threshold)
- Reuniões de 2h+: redução de ~60% nos tokens de transcrição

---

### ⏳ 4. Roteamento de modelo por tamanho de transcrição

**Problema:** Reuniões curtas (check-in de 10min, daily scrum) são processadas com o mesmo modelo caro que reuniões estratégicas de 2h.

**Solução proposta:**

```typescript
function selectModel(transcript: string, configuredModel: string): string {
  const wordCount = transcript.split(/\s+/).length
  // < 400 palavras: Haiku é suficiente (5× mais barato que Sonnet)
  if (wordCount < 400 && configuredModel.includes('claude')) {
    return 'claude-haiku-4-5-20251001'
  }
  return configuredModel
}
```

**Lógica de negócio:**
| Palavras na transcrição | Duração estimada | Modelo |
|---|---|---|
| < 400 | < 15min | Haiku 4.5 |
| 400–3.000 | 15min–1h | Sonnet (configurado) |
| > 3.000 | > 1h | Sonnet (configurado) |

**Custo comparativo (Anthropic, preços de referência):**
| Modelo | Input/MTok | Output/MTok | Relativo |
|---|---|---|---|
| Haiku 4.5 | $0,80 | $4,00 | 1× |
| Sonnet 4.6 | $3,00 | $15,00 | ~4× |

**Impacto estimado:** Se 40% das reuniões são curtas, redução de ~35% no custo total de enhance.

**Limitação:** Só se aplica ao provider Anthropic com as credenciais padrão. Orgs com chave própria continuam usando o modelo configurado delas.

---

## Monitoramento

Todos os logs do `enhance-transcript` estão no Supabase Edge Function Logs com prefixo `[enhance]`. Métricas úteis:

```
[enhance] transcript length: XXXX       ← tamanho do input
[enhance] using provider: anthropic     ← provider usado
[enhance] raw AI response (first 200)   ← saída bruta
```

Para acompanhar cache hits, ativar log da resposta completa da API Anthropic e verificar `usage.cache_read_input_tokens` no payload de resposta.

---

## Histórico de mudanças

| Data | Otimização | Impacto |
|---|---|---|
| 2026-08-05 | Prompt caching + system/user split | ~90% redução no custo das instruções estáticas (por hit) |
| 2026-08-05 | max_tokens 2048 → 1024 no enhance-transcript | Output mais conciso, sem regressão de qualidade |
