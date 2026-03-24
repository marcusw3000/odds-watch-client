

# Reimplementar Chat Global com Supabase (Persistência + Realtime)

## O que será feito

Remover completamente a implementação atual de chat (broadcast efêmero) e substituir por uma versão completa com persistência no banco de dados, usando Supabase Postgres + Realtime.

## Arquitetura

```text
┌─────────────┐     INSERT      ┌──────────────┐
│  ChatInput   │ ──────────────► │   messages   │
│ (300 chars)  │                 │   (Postgres) │
└─────────────┘                 └──────┬───────┘
                                       │ Realtime
                                       │ (postgres_changes)
                                       ▼
                                ┌──────────────┐
                                │  ChatMessage  │
                                │  (all users)  │
                                └──────────────┘
```

## 1. Migration SQL — tabela `messages`

Criar tabela `messages` com:
- `id uuid PK default gen_random_uuid()`
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `username text NOT NULL`
- `content text NOT NULL CHECK(char_length(content) <= 300)`
- `created_at timestamptz NOT NULL DEFAULT now()`

Adicionar:
- Índice em `created_at DESC`
- RLS habilitado
- Policy SELECT: authenticated users podem ler todas as mensagens
- Policy INSERT: authenticated users podem inserir apenas com `auth.uid() = user_id`
- `pg_cron` job a cada 3 horas para deletar mensagens com mais de 6 horas
- Habilitar Realtime para a tabela `messages`

## 2. Deletar arquivos antigos

Remover:
- `src/components/chat/ChatInput.tsx` (será reescrito)
- `src/components/chat/ChatMessage.tsx` (será reescrito)
- `src/components/chat/GlobalChat.tsx` (será reescrito)
- `src/hooks/useGlobalChat.ts` (será reescrito)

## 3. Novo hook: `src/hooks/useGlobalChat.ts`

- Busca mensagens das últimas 6 horas no mount (`supabase.from('messages').select(...)`)
- Subscrição Realtime via `postgres_changes` (INSERT) na tabela `messages`
- Deduplicação por `id` ao receber mensagem do Realtime
- Anti-flood: 1 mensagem a cada 2 segundos (ref local)
- Envio: `supabase.from('messages').insert(...)` — busca `display_name` do perfil
- Estado: `messages`, `isLoading`, `error`, `isConnected`, `sendMessage`
- Limite de 300 caracteres no envio

## 4. Novos componentes em `src/components/chat/`

### `GlobalChat.tsx`
- Botão flutuante (FAB) com ícone de chat e badge de não-lidas
- Abre Sheet lateral (mantém mesmo padrão visual)
- Indicador de conexão (Wifi/WifiOff)
- Lista de mensagens com auto-scroll
- Empty state e loading state

### `ChatMessage.tsx`
- Bolha de mensagem com nome, conteúdo e horário
- Estilo diferente para mensagens próprias vs. outros
- Botão de reportar em mensagens de outros

### `ChatInput.tsx`
- Textarea com limite de 300 caracteres
- Contador de caracteres visível
- Botão enviar
- Desabilitado para não autenticados
- Envio com Enter (Shift+Enter para nova linha)

## 5. Atualizar Layout.tsx

- Manter o `ChatErrorBoundary` existente
- Importar o novo `GlobalChat` (mesmo path)

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| Nova migration SQL | Criar tabela `messages` + RLS + cron |
| `src/hooks/useGlobalChat.ts` | Reescrever completamente |
| `src/components/chat/GlobalChat.tsx` | Reescrever completamente |
| `src/components/chat/ChatMessage.tsx` | Reescrever completamente |
| `src/components/chat/ChatInput.tsx` | Reescrever com contador de 300 chars |
| `src/components/layout/Layout.tsx` | Sem mudanças (já importa GlobalChat) |

