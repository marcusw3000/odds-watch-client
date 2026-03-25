

# Fix: Race Condition na Notificação de Sugestão Implementada

## Problema
O `useEffect` (linha 59) busca dados da sugestão de forma assíncrona via `useRef`, mas se o admin submeter o formulário antes do fetch terminar, `suggestionDataRef.current` é `null` e a notificação nunca é disparada — sem erro, sem log.

## Solução

### Arquivo: `src/pages/admin/AdminEventFormPage.tsx`

**Remover** linhas 55-70 (o `useRef` e o `useEffect` que busca dados da sugestão).

**Substituir** linhas 294-307 por um fetch direto no `handleSubmit`:

```ts
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
    console.error('Error linking suggestion to market:', linkError);
  }
}
```

Isso elimina a race condition ao garantir que os dados da sugestão sejam buscados sincronamente dentro do fluxo de submit, antes de notificar.

**1 arquivo, ~15 linhas alteradas.**

