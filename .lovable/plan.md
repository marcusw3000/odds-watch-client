

# Adicionar Templates de Email para Notificações de Sugestão

## Problema

A edge function `send-notification-email` não possui templates específicos para os tipos `SUGGESTION_IMPLEMENTED`, `SUGGESTION_APPROVED` e `SUGGESTION_REJECTED`. Quando esses tipos são enviados, o sistema usa o template `DEFAULT` genérico — que funciona mas produz um email sem contexto visual. Além disso, se o perfil do usuário não tiver email cadastrado, a função retorna 404 silenciosamente.

## O que será feito

Adicionar 3 templates de email dedicados à edge function `send-notification-email` e redeployar.

## Arquivo: `supabase/functions/send-notification-email/index.ts`

Adicionar 3 entradas no objeto `emailTemplates`:

1. **`SUGGESTION_APPROVED`** — Assunto: "✅ Sugestão Aprovada", corpo com título da sugestão, botão "Ver sugestão" linkando para `/suggestions/{suggestion_id}`

2. **`SUGGESTION_REJECTED`** — Assunto: "Sugestão Não Aprovada", corpo com título e motivo (se houver), botão "Ver sugestão"

3. **`SUGGESTION_IMPLEMENTED`** — Assunto: "🚀 Sua sugestão virou mercado!", corpo com título da sugestão, botão "Ver mercado" linkando para `/market/{market_id}`

Cada template segue o mesmo padrão visual dos existentes (header PredictMarket roxo, card de destaque, botão CTA, rodapé).

Após editar, a edge function será redeployada.

