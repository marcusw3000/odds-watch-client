

# Fix: Notificação e Email de Sugestão Implementada

## Problema Identificado

**Race condition no fetch dos dados da sugestão.** O `useEffect` na linha 59 busca `user_id` e `title` da sugestão de forma assíncrona, mas não há garantia de que o fetch termina antes do admin submeter o formulário. Se `suggestionDataRef.current` for `null`, o bloco `if (suggestionId && suggestionDataRef.current)` na linha 295 é ignorado silenciosamente — sem notificação, sem email, sem erro no console.

Possível causa secundária: a edge function `send-notification-email` pode não ter sido redeployada após a adição dos templates, ou a `RESEND_API_KEY` pode não estar configurada nos secrets do Supabase.

## Solução

### 1. `src/pages/admin/AdminEventFormPage.tsx` — Eliminar race condition

Trocar o `useEffect` + `ref` por um fetch direto **dentro do `handleSubmit`**, garantindo que os dados existam antes de notificar:

```ts
// REMOVER: useEffect + suggestionDataRef

// NO handleSubmit, após createEventMutation.mutateAsync retornar:
if (suggestionId) {
  try {
    const { data: suggestionData } = await supabase
      .from('market_suggestions')
      .select('user_id, title')
      .eq('id', suggestionId)
      .single();

    if (suggestionData) {
      await SuggestionService.implementSuggestion(suggestionId, result.event.id);
      await notifySuggestionImplemented(
        suggestionData.user_id,
        suggestionId,
        suggestionData.title,
        result.event.id
      );
    }
  } catch (linkError) {
    console.error('Error linking suggestion:', linkError);
  }
}
```

### 2. Redeploy da edge function `send-notification-email`

Redeployar para garantir que os templates `SUGGESTION_IMPLEMENTED`, `SUGGESTION_APPROVED` e `SUGGESTION_REJECTED` estejam ativos no runtime.

### 3. Verificar `RESEND_API_KEY`

Confirmar que o secret está configurado nas edge functions do Supabase. Sem ele, nenhum email é enviado.

## Resumo das mudanças

- **1 arquivo editado**: `AdminEventFormPage.tsx` — remover `useEffect`/`useRef` da sugestão, mover fetch para dentro do `handleSubmit`
- **1 redeploy**: `send-notification-email`
- **1 verificação**: `RESEND_API_KEY` nos secrets

