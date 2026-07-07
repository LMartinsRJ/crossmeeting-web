# Crossmeeting — Integrações de entrada (fontes externas)

Documentação das integrações que importam transcrições de ferramentas externas para o Crossmeeting.

---

## Visão geral

Todas as integrações aparecem em `/settings → API & Integrações` na seção "Entrada — Fontes externas". Cada fonte tem um card dedicado com estado de conexão, botão de sincronização e feedback de erros.

As transcrições importadas ficam na tabela `meetings` com `source = '<nome_da_fonte>'`.

---

## Fireflies.ai ✅

**Tipo:** API key pessoal  
**Campo salvo em:** `integration_credentials` (source = `fireflies`, api_key = chave)

### Fluxo
1. Usuário cola a API key no `FirefliesCard`
2. POST `/api/integrations/fireflies/connect` valida via GraphQL `{ me { id name email } }` e salva
3. POST `/api/integrations/fireflies/sync` busca transcrições desde `last_synced_at`, chama Claude para enhancement, insere em `meetings`

### Endpoints
- `POST /api/integrations/fireflies/connect` — salvar/validar chave
- `DELETE /api/integrations/fireflies/connect` — desconectar
- `POST /api/integrations/fireflies/sync` — importar transcrições

---

## Microsoft Teams ✅

**Tipo:** Microsoft OAuth (auto-detectado a partir do login com Microsoft)  
**Token em:** `profiles.microsoft_calendar_token`

### Fluxo
1. Se o usuário fez login com Microsoft, `TeamsCard` exibe "Conta vinculada"
2. Botão "Sincronizar Teams" chama POST `/api/integrations/teams/sync`
3. Route busca `profiles.microsoft_calendar_token`, chama Graph API `GET /me/onlineMeetings`
4. Para cada reunião, tenta buscar transcrição via `GET /me/onlineMeetings/{id}/transcripts`
5. Se transcrição disponível, exporta como VTT, chama Claude para enhancement e insere em `meetings`

### Botão "Re-autorizar escopos"
Dispara `supabase.auth.signInWithOAuth({ provider: 'azure', scopes: 'Calendars.Read OnlineMeetings.Read OnlineMeetingTranscript.Read.All offline_access' })` para solicitar escopos adicionais de transcrição.

### Limitações
- `OnlineMeetingTranscript.Read.All` requer **conta Microsoft 365 organizacional** (não funciona com contas pessoais @outlook.com/@hotmail.com)
- A política de gravação automática de transcrições deve estar habilitada pelo administrador de TI do domínio
- O token de calendário inicial (login OAuth) pode não ter os escopos de transcrição — o botão "Re-autorizar escopos" resolve isso

### Endpoints
- `POST /api/integrations/teams/sync` — importar transcrições do Teams

---

## Google Meet ✅

**Tipo:** Google OAuth (auto-detectado a partir do login com Google)  
**Token em:** `profiles.google_calendar_token`

### Fluxo
1. Se o usuário fez login com Google, `GoogleMeetCard` exibe "Conta vinculada"
2. Botão "Sincronizar Meet" chama POST `/api/integrations/google-meet/sync`
3. Route busca `profiles.google_calendar_token`, chama Drive API buscando Google Docs com "Transcrição" ou "Transcript" no nome
4. Para cada arquivo, exporta como texto puro via `files/{id}/export?mimeType=text/plain`
5. Chama Claude para enhancement e insere em `meetings`

### Botão "Re-autorizar Drive"
Dispara re-auth Google com escopo `https://www.googleapis.com/auth/drive.readonly` adicionado (além de `calendar.readonly`).

### Limitações
- Transcrições automáticas do Meet são salvas no Drive **apenas** para contas Google Workspace Business Standard ou superior
- O administrador do Workspace deve ter habilitado a função "Gravar transcrições" nas políticas do Meet
- O token do login inicial (Google OAuth) pode não ter o escopo de Drive — "Re-autorizar Drive" resolve

### Endpoints
- `POST /api/integrations/google-meet/sync` — importar transcrições do Meet

---

## Zoom ✅

**Tipo:** Server-to-Server OAuth (credenciais do Zoom Marketplace)  
**Campos salvos em:** `integration_credentials` (source = `zoom`, api_key = JSON com `account_id + client_id + client_secret`)

### Como obter credenciais
1. Acessar [marketplace.zoom.us](https://marketplace.zoom.us)
2. Criar um app do tipo **Server-to-Server OAuth**
3. Copiar Account ID, Client ID e Client Secret
4. Conceder as permissões: `cloud_recording:read:list_user_recordings:admin` (ou `:master`)

### Fluxo
1. Usuário preenche Account ID + Client ID + Client Secret no `ZoomCard`
2. POST `/api/integrations/zoom/connect` valida obtendo um token (`grant_type=account_credentials`) e salva as credenciais como JSON em `api_key`
3. POST `/api/integrations/zoom/sync` obtém token fresh, busca `GET /v2/users/me/recordings?from=<last_synced>&to=<hoje>`, para cada gravação localiza o arquivo VTT de transcrição, chama Claude para enhancement, insere em `meetings`

### Endpoint de token
```
POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id={accountId}
Authorization: Basic base64(clientId:clientSecret)
```

### Formato do arquivo de transcrição
Zoom salva transcrições como VTT (`file_type: 'TRANSCRIPT'` ou `file_extension: 'VTT'`). O download requer `?access_token={token}` na URL.

### Endpoints
- `POST /api/integrations/zoom/connect` — salvar/validar credenciais
- `DELETE /api/integrations/zoom/connect` — desconectar
- `POST /api/integrations/zoom/sync` — importar gravações e transcrições

---

## Otter.ai ✅

**Tipo:** API key Enterprise  
**Campo salvo em:** `integration_credentials` (source = `otter`, api_key = chave)

### Como obter a chave
Otter.ai → Integrations (menu lateral) → Developer → Create key. Requer **plano Enterprise**.

### Fluxo
1. Usuário cola a chave Enterprise no `OtterCard`
2. POST `/api/integrations/otter/connect` salva (sem validação prévia — a API não tem endpoint de ping)
3. POST `/api/integrations/otter/sync`:
   - `GET /workspaces` — lista workspaces do usuário
   - Para cada workspace: `GET /workspace/{id}/conversations?limit=30&cursor=` — lista conversas paginadas, filtrando por `created_after=last_synced_at`
   - Para cada conversa: `GET /conversations/{id}?include=transcript,action_items` — transcrição completa com speakers
   - Monta texto `Speaker: texto` por utterance
   - Claude enhancement → insere em `meetings` com `source='otter'`

### Formato de transcrição
```json
{
  "transcript": {
    "utterances": [
      { "speaker_name": "Leandro", "text": "Bom dia a todos..." },
      { "speaker_name": "Ana", "text": "Vamos começar pela pauta..." }
    ]
  }
}
```

### Endpoints internos
- `POST /api/integrations/otter/connect` — salvar chave
- `DELETE /api/integrations/otter/connect` — remover chave
- `POST /api/integrations/otter/sync` — importar conversas e transcrições

### Limitação
API requer plano **Enterprise**. Rate limit: 60 req/min (Pro) / 500 req/min (Enterprise).

---

## Granola ✅

**Tipo:** API key (`grn_...`)  
**Campo salvo em:** `integration_credentials` (source = `granola`, api_key = chave)

### Como obter a chave
Granola desktop → Settings → Connectors → API keys → criar nova chave com escopo "Personal notes".

### Fluxo
1. Usuário cola a chave `grn_...` no `GranolaCard`
2. POST `/api/integrations/granola/connect` valida chamando `GET /v1/notes?page_size=1` e salva
3. POST `/api/integrations/granola/sync`:
   - Pagina `GET /v1/notes?created_after={last_synced_at}&page_size=30` (até 10 páginas)
   - Para cada nota: `GET /v1/notes/{id}?include=transcript`
   - Monta texto da transcrição distinguindo `microphone` (o próprio usuário) de `speaker` (outros)
   - Se sem transcrição, usa `summary` da nota
   - Claude enhancement → insere em `meetings` com `source='granola'`

### Formato de transcrição
```json
{
  "transcript": [
    { "source": "microphone", "text": "Bom dia..." },
    { "source": "speaker", "text": "Olá, pode começar..." }
  ]
}
```

### Endpoints internos
- `POST /api/integrations/granola/connect` — validar e salvar chave
- `DELETE /api/integrations/granola/connect` — remover chave
- `POST /api/integrations/granola/sync` — importar notas e transcrições

### API oficial Granola
- Base URL: `https://public-api.granola.ai/v1`
- Rate limit: 25 req/5s (burst) / 300 req/min (sustained)
- Notas de equipe/workspace não são acessíveis (apenas "My notes")
- Transcrições disponíveis apenas em planos pagos do Granola

---

*(Granola lançou a API oficial em 2025 — a integração completa está documentada acima.)*

---

## Banco de dados

### Tabela `integration_credentials`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | bigint | PK |
| `user_id` | uuid | `profiles.id` |
| `source` | text | `fireflies`, `teams`, `google_meet`, `zoom`, `otter` |
| `api_key` | text | Chave de API, token ou JSON de credenciais |
| `status` | text | `active` \| `error` |
| `last_synced_at` | timestamptz | Cursor de última importação |
| `synced_count` | integer | Total de reuniões importadas |
| `error_count` | integer | Falhas consecutivas |
| `error_message` | text | Último erro |

**RLS:** `FOR ALL WHERE user_id = auth_profile_id()`

### Campo `source` em `meetings`

Coluna `source text DEFAULT 'crossmeeting'` adicionada à tabela `meetings`. Possíveis valores:
- `crossmeeting` — gravação nativa (desktop/Android)
- `fireflies` — importado do Fireflies.ai
- `teams` — importado do Microsoft Teams
- `google_meet` — importado do Google Meet
- `zoom` — importado do Zoom

---

## Enhancement automático com Claude

Todas as fontes que retornam texto de transcrição passam pelo enhancement do Claude:

```typescript
{
  title: string,          // título inferido do conteúdo
  summary: string,        // resumo em 2-3 frases
  key_points: string[],   // pontos principais
  action_items: { text: string, owner?: string }[],
  decisions: string[],
}
```

Se a transcrição não estiver disponível (ex: reunião Teams sem gravação, reunião Zoom sem arquivo VTT), a reunião é importada sem enhancement e sem transcrição, apenas com título e metadados.
