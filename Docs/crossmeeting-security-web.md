# Análise de Segurança — Crossmeeting Web (Next.js)

**Data:** 2026-07-28  
**Escopo:** `crossmeeting-web/` — App Router (Next.js 16), Supabase Auth, Edge Functions  
**Revisor:** Claude Sonnet 4.6  

---

## Resumo Executivo

A aplicação web tem uma postura de segurança geral satisfatória: autenticação via Supabase + cookies HttpOnly, RLS ativa em todas as tabelas principais, e verificações de autorização em rotas críticas de admin. As vulnerabilidades encontradas concentram-se em ausência de hardening HTTP e em dois vetores de abuso de recursos (rate limiting e SSRF).

| Severidade | Quantidade |
|-----------|------------|
| Alta       | 1          |
| Média      | 3          |
| Baixa      | 3          |
| Info       | 2          |

---

## Vulnerabilidades

### [ALTA] SSRF no teste de webhook

**Arquivo:** `app/api/webhooks/[id]/route.ts` (linha 54)  
**Arquivo secundário:** `lib/webhooks.ts` (linha 36)

```typescript
const res = await fetch(wh.url, { method: 'POST', ... })
```

A rota de "test webhook" (`POST /api/webhooks/[id]`) e o dispatcher `fireWebhooks` em `lib/webhooks.ts` fazem `fetch(url)` diretamente com a URL fornecida pelo usuário, sem validar se aponta para redes internas.

**Impacto:** Um usuário autenticado pode registrar um webhook apontando para `http://169.254.169.254/latest/meta-data/` (AWS IMDS), `http://10.x.x.x/`, ou `http://localhost/` e receber a resposta via logs de erro ou comportamento diferencial. Em ambientes cloud, isso pode expor credenciais de instância IAM.

**Correção recomendada:**
```typescript
function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname)
  } catch { return true }
}
// Antes de fetch: if (isPrivateUrl(url)) return 403
```

---

### [MÉDIA] Ausência de headers de segurança HTTP

**Arquivo:** `next.config.ts`

O arquivo de configuração não define nenhum header de segurança. Nenhum dos seguintes está presente:

| Header | Risco sem ele |
|--------|--------------|
| `Content-Security-Policy` | XSS via injeção de script |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking |
| `X-Content-Type-Options: nosniff` | MIME sniffing |
| `Strict-Transport-Security` | Downgrade para HTTP |
| `Referrer-Policy` | Vazamento de URL em requisições cross-origin |
| `Permissions-Policy` | Acesso desnecessário a câmera/microfone |

**Correção recomendada:** Adicionar bloco `headers()` em `next.config.ts`:
```typescript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ],
  }]
}
```
CSP deve ser configurado separadamente com cuidado para não quebrar o Supabase realtime e o carregamento de avatares.

---

### [MÉDIA] Sem rate limit em chamadas ao Claude (analytics e space chat)

**Arquivos:**  
- `app/api/analytics/route.ts`  
- `app/api/spaces/[id]/chat/route.ts`

Ambas as rotas chamam Claude Sonnet sem nenhum controle de frequência. Um usuário autenticado pode fazer centenas de requisições por minuto, gerando custo elevado de API.

`/api/import-transcript` tem rate limit correto (10/hora via tabela `import_rate_limits`), mas não foi replicado nas demais.

**Adicionalmente em `/api/analytics`:** o intervalo de datas `from`/`to` vem direto do body sem validação de tamanho. Uma janela de anos pode gerar prompts enormes e lentidão.

**Correção recomendada:**
- Reutilizar o padrão da tabela `import_rate_limits` para `analytics_rate_limits` (ex: 20 req/hora) e `chat_rate_limits` (ex: 60 req/hora).  
- Em analytics, validar que `to - from <= 90 days`.

---

### [MÉDIA] Token refresh Microsoft não implementado em sync-calendar

**Arquivo:** `app/api/sync-calendar/route.ts`

O Google Calendar tem refresh de token implementado (`refreshGoogleToken`). O Microsoft/Outlook não — quando o `access_token` expira, a sincronização simplesmente falha silenciosamente.

Isso não é um problema de segurança direto, mas o `refresh_token` do Microsoft fica armazenado em `profiles` sem uso, e se a lógica de refresh for adicionada sem tratamento adequado de erro, pode vazar tokens em logs.

**Correção recomendada:** Implementar `refreshMicrosoftToken` análogo ao do Google, ou exibir erro claro ao usuário pedindo reconexão.

---

### [BAIXA] URLs de meeting link controladas pelo calendar provider

**Arquivo:** `app/api/sync-calendar/route.ts` — `extractGoogleMeetingLink`

A função extrai links de reunião dos campos `location` e `description` do evento de calendário. Esses campos são controlados pelo criador do evento. Um convite malicioso poderia incluir um `location: javascript:...` ou URL de phishing que seria salvo no banco e exibido ao usuário.

**Impacto:** Baixo — depende de o usuário aceitar convite malicioso e clicar no link dentro do Crossmeeting.

**Correção recomendada:** Validar que `meetingLink` começa com `https://` antes de salvar.

---

### [BAIXA] `whatsapp_url` em org settings sem validação de URL

**Arquivo:** `app/api/org/settings/route.ts` (linha 50)

O campo `whatsapp_url` é aceito e armazenado sem validação. Pode ser usado para armazenar URLs internas se o campo for utilizado em webhooks ou redirects futuros.

**Correção:** Validar `whatsapp_url` com `new URL(url)` e rejeitar IPs privados, assim como em webhooks.

---

### [BAIXA] Sem validação do intervalo de datas em analytics

**Arquivo:** `app/api/analytics/route.ts`

O campo `from` e `to` são passados diretamente como filtros ao Supabase. Intervalos muito grandes podem resultar em consultas lentas e prompts gigantescos para o Claude.

**Correção:** Limitar a `to - from <= 90 dias` e retornar 400 se exceder.

---

### [INFO] `ai_custom_endpoint` sem validação no org settings

**Arquivo:** `app/api/org/settings/route.ts`

Org admins podem configurar `ai_custom_endpoint`, que provavelmente é usado para apontar para um proxy de IA alternativo. Não foi possível rastrear onde esse valor é consumido, mas se enviado em requisições `fetch()`, pode ser um vetor SSRF para admins de org.

**Ação:** Verificar onde `ai_custom_endpoint` é utilizado e aplicar mesma validação anti-SSRF.

---

### [INFO] `adminClient()` com SERVICE_ROLE_KEY no servidor

**Arquivo:** `lib/superAdmin.ts`, `app/api/org/settings/route.ts`, `app/api/admin/orgs/route.ts`

O client com `SERVICE_ROLE_KEY` contorna completamente o RLS. O uso está devidamente protegido por `isSuperAdmin()` ou verificação de `orgRole === 'admin'`. Não há vulnerabilidade identificada, mas qualquer nova rota que use `adminClient()` sem verificação de autorização seria crítica.

**Ação:** Manter como padrão: toda rota que chamar `adminClient()` deve verificar autorização antes.

---

## O que está bem

- **Middleware (S3 corrigido):** API routes sem sessão retornam 401 JSON em vez de redirect — proteção contra acesso anônimo.
- **Open redirect (S2 corrigido):** `auth/callback/route.ts` valida que `next` começa com `/` e não com `//`.
- **Endpoint dev-only (S1 corrigido):** `app/api/test/set-session/route.ts` foi deletado.
- **RLS ativa:** Todas as operações de usuário final passam pelo client com ANON_KEY — RLS do Supabase é a última linha de defesa.
- **Soft delete com pg_cron:** Meetings e spaces são soft-deletados e purgados após 15 dias; não há exclusão permanente imediata exposta via API.
- **HMAC em webhooks:** Payloads entregues assinados com `sha256=<hmac>` se o usuário configurar um secret.
- **Scope de deleção de webhook:** `DELETE /api/webhooks/[id]` filtra por `user_id` — usuário não consegue deletar webhook de outro.
- **Injeção em space chat:** System prompt instrui o modelo a tratar conteúdo de transcrições como dados, não como comandos — mitigação básica de prompt injection.
- **Rate limit em import:** 10 importações/hora por usuário com contagem em banco.
- **Validação de campos em org settings:** Allowlist explícita de campos na rota PATCH — sem mass assignment.

---

## Priorização

| # | Item | Esforço |
|---|------|---------|
| 1 | Blocklist SSRF em webhook test + fireWebhooks | Pequeno (~15 linhas) |
| 2 | Security headers em next.config.ts | Pequeno (~20 linhas) |
| 3 | Rate limit em `/api/analytics` e `/api/spaces/[id]/chat` | Médio |
| 4 | Validação de intervalo de datas em analytics | Pequeno |
| 5 | Validar `https://` em meeting links extraídos do calendário | Trivial |
| 6 | Implementar refresh de token Microsoft | Médio |
