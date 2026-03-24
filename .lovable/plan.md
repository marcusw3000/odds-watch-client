

# Integrar Denúncias do Chat na Página Admin de Denúncias

## Problema
A tabela `chat_reports` existe e funciona, mas o `CommentService.getReports()` só busca de `comment_reports` e `suggestion_comment_reports`. As denúncias do chat nunca aparecem na tela do admin.

Além disso, a tabela `chat_reports` tem um schema simples (sem `status`, `reviewed_by`, `reviewed_at`, `action_taken`), o que impede o admin de processar/dispensar denúncias do chat.

## Plano

### 1. Migration SQL — adicionar colunas de moderação ao `chat_reports`

Adicionar as colunas que faltam para permitir ações de moderação:
- `status text NOT NULL DEFAULT 'PENDING'`
- `reviewed_by uuid REFERENCES auth.users(id)`
- `reviewed_at timestamptz`
- `action_taken text`
- `description text` (detalhes opcionais do reporter)

Adicionar policy de UPDATE para admins.

### 2. Atualizar `CommentService.getReports()` 

Adicionar uma terceira query para `chat_reports` com join na tabela `messages`:
- Buscar `chat_reports` + `messages:message_id (id, content, user_id, username)`
- Mapear para `CommentReport[]` com `source: 'chat'`
- Incluir no merge final e ordenação

### 3. Atualizar `CommentService.updateReportStatus()`

Adicionar suporte para `source === 'chat'`:
- Atualizar `chat_reports` (status, reviewed_by, reviewed_at, action_taken)
- Para ação `deleted`: deletar a mensagem da tabela `messages`

### 4. Atualizar tipo `CommentReport` em `src/types/comment.ts`

- Expandir `source` para incluir `'chat'`: `source: 'market' | 'suggestion' | 'chat'`

### 5. Atualizar `AdminReportsPage.tsx`

- Adicionar badge "Chat" para denúncias com `source === 'chat'`
- Mostrar username da mensagem ao invés de link para mercado/sugestão
- Título da página: "Denúncias de Comentários e Chat"

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| Nova migration SQL | Adicionar colunas de moderação ao `chat_reports` + UPDATE policy |
| `src/types/comment.ts` | Adicionar `'chat'` ao tipo `source` |
| `src/services/CommentService.ts` | Buscar e processar `chat_reports` |
| `src/pages/admin/AdminReportsPage.tsx` | Exibir denúncias do chat com badge |

