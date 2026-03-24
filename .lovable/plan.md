

# Implementar Denúncia de Mensagens do Chat

## Problema
A função `reportMessage` no hook `useGlobalChat.ts` apenas exibe um toast falso — não salva nada no banco de dados.

## Solução

### 1. Migration SQL — tabela `chat_reports`

Criar tabela `chat_reports` com:
- `id uuid PK default gen_random_uuid()`
- `message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE`
- `reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `reason text NOT NULL DEFAULT 'inappropriate'`
- `created_at timestamptz NOT NULL DEFAULT now()`
- Constraint UNIQUE em `(message_id, reporter_id)` para evitar denúncias duplicadas

RLS:
- SELECT: admins podem ver todas as denúncias
- INSERT: usuários autenticados podem inserir apenas com `auth.uid() = reporter_id`
- Sem UPDATE/DELETE para usuários comuns

### 2. Atualizar `useGlobalChat.ts`

Trocar a função `reportMessage` de toast fake para um insert real:
```ts
const reportMessage = useCallback(async (messageId: string) => {
  if (!user) return;
  const { error } = await supabase
    .from('chat_reports')
    .insert({ message_id: messageId, reporter_id: user.id });
  if (error?.code === '23505') {
    toast.info('Você já reportou esta mensagem');
  } else if (error) {
    toast.error('Erro ao reportar mensagem');
  } else {
    toast.success('Mensagem reportada. Obrigado!');
  }
}, [user]);
```

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| Nova migration SQL | Criar tabela `chat_reports` + RLS |
| `src/hooks/useGlobalChat.ts` | Implementar `reportMessage` real |

