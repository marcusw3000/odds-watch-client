

# Plano: Corrigir cancelamento de copy subscription quebrado pela trigger

## Problema

A trigger `protect_copy_subscription_fields` (criada na Fase 2) protege o campo `status` de alteracoes por usuarios comuns. Porem, o hook `useCancelCopySubscription()` em `src/hooks/useCopyTrade.ts` faz um `.update({ status: 'CANCELLED' })` diretamente do client-side. A trigger agora reseta `status` para o valor original, **quebrando silenciosamente a funcionalidade de cancelamento**.

## Solucao

Criar uma Edge Function `cancel-copy-subscription` que:
1. Autentica o usuario via JWT
2. Verifica que a subscription pertence ao usuario (`follower_id = userId`)
3. Usa `service_role` para fazer o UPDATE de `status` e `cancelled_at`
4. Retorna sucesso/erro

Atualizar `useCancelCopySubscription()` para chamar a Edge Function em vez de fazer update direto.

---

## Detalhes Tecnicos

### 1. Nova Edge Function: `cancel-copy-subscription`

- Recebe `{ subscription_id: string }` no body
- Valida JWT com `getClaims(token)`
- Cria client `service_role` para buscar a subscription e verificar que `follower_id` corresponde ao usuario
- Faz o UPDATE com `service_role`: `{ status: 'CANCELLED', cancelled_at: now() }`
- Retorna `{ success: true }` ou `{ error: "..." }`

### 2. Atualizar `supabase/config.toml`

Adicionar:
```
[functions.cancel-copy-subscription]
verify_jwt = false
```

### 3. Atualizar `useCancelCopySubscription()` em `src/hooks/useCopyTrade.ts`

Substituir o `.from('copy_subscriptions').update(...)` por `supabase.functions.invoke('cancel-copy-subscription', { body: { subscription_id } })`.

### 4. Nenhuma outra alteracao pendente

Todas as outras operacoes client-side estao cobertas:
- Updates de perfil (nome, bio, avatar): permitidos pela trigger
- Updates de subscription settings (auto_copy, max_trade_amount, copy_percentage): permitidos pela trigger
- Admin operations (approve/reject trader, update settings): permitidos pela trigger (verifica admin)
- Notifications INSERT: risco aceito (usuario so afeta proprio feed)
- Comments, suggestions, favorites, support tickets: protegidos por RLS com owner-check, sem campos sensiveis a proteger

