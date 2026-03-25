

# Notificar Autor quando Sugestão for Transformada em Mercado

## O que será feito

Quando o admin cria um mercado a partir de uma sugestão (via `?suggestion_id=X` na URL), o sistema irá:
1. Marcar a sugestão como `IMPLEMENTED` vinculando ao mercado criado
2. Enviar notificação ao autor da sugestão
3. Exibir a notificação com ícone e link para o mercado

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `src/types/notification.ts` | Adicionar `SUGGESTION_IMPLEMENTED` |
| `src/services/NotificationService.ts` | Adicionar `notifySuggestionImplemented` |
| `src/pages/admin/AdminEventFormPage.tsx` | Ler `suggestion_id` da URL, após criar mercado: chamar `implementSuggestion` + notificar autor |
| `src/components/notifications/NotificationBell.tsx` | Adicionar ícone/cor + link para o mercado |
| Migration SQL | `ALTER TYPE notification_type ADD VALUE 'SUGGESTION_IMPLEMENTED'` |

## Detalhes

### 1. `src/types/notification.ts`
Adicionar `'SUGGESTION_IMPLEMENTED'` ao union type.

### 2. `src/services/NotificationService.ts`
Nova função:
```ts
export async function notifySuggestionImplemented(
  userId: string, suggestionId: string, suggestionTitle: string, marketId: string
) {
  return createNotification({
    userId,
    type: 'SUGGESTION_IMPLEMENTED',
    title: 'Sua sugestão virou mercado! 🚀',
    message: `Sua sugestão "${suggestionTitle}" foi transformada em um mercado de previsão!`,
    data: { suggestion_id: suggestionId, suggestion_title: suggestionTitle, market_id: marketId },
    sendEmail: true,
  });
}
```

### 3. `src/pages/admin/AdminEventFormPage.tsx`
- Usar `useSearchParams` para ler `suggestion_id`
- Quando `suggestion_id` presente, buscar a sugestão (user_id, title) via `supabase.from('market_suggestions').select('id, user_id, title')`
- Após `createEventMutation.mutateAsync` retornar com sucesso (~linha 270), em try/catch isolado:
  1. `SuggestionService.implementSuggestion(suggestionId, result.event.id)`
  2. `notifySuggestionImplemented(suggestion.user_id, suggestionId, suggestion.title, result.event.id)`
- Falhas não bloqueiam a criação do mercado

### 4. `src/components/notifications/NotificationBell.tsx`
- Ícone: `Rocket` (lucide-react), cor: `text-purple-500 bg-purple-500/10`
- Link: `data?.market_id ? /market/${data.market_id} : /suggestions`

### 5. Migration
```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'SUGGESTION_IMPLEMENTED';
```

