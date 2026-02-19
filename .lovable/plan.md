
# Plano: Mitigacao de Vulnerabilidades Remanescentes (Fase 2)

## Resumo

Auditoria completa do codebase contra o principio "toda operacao sensivel deve ser autorizada no servidor". Encontradas 4 vulnerabilidades adicionais alem das ja corrigidas na Fase 1.

---

## Vulnerabilidade 1: copy_subscriptions UPDATE sem restricao de campos (ALTA)

**Problema**: A policy RLS de UPDATE permite `follower_id = auth.uid()`, ou seja, o usuario pode alterar qualquer coluna da propria assinatura via DevTools, incluindo:
- `status`: reativar assinatura cancelada (de `CANCELLED` para `ACTIVE`)
- `total_trades_copied`, `total_profit`, `total_commission_paid`: inflar estatisticas
- `stripe_subscription_id`, `stripe_customer_id`: alterar dados de pagamento

**Solucao**: Criar trigger `BEFORE UPDATE` na tabela `copy_subscriptions` similar ao que fizemos para `profiles` e `copy_traders`.

**Campos protegidos** (somente admin/service_role):
- status, cancelled_at, total_trades_copied, total_profit, total_commission_paid, monthly_fee_paid, last_payment_at, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id, payment_method

**Campos permitidos** (follower pode alterar):
- auto_copy, max_trade_amount, copy_percentage

---

## Vulnerabilidade 2: linkReferral() falha silenciosamente (MEDIA)

**Problema**: O metodo `ReferralService.linkReferral()` e chamado em `AuthPage.tsx` apos signup para vincular um codigo de indicacao. Ele tenta fazer `.update()` na tabela `referrals`, mas nao existe policy RLS de UPDATE para usuarios comuns. Resultado: **a vinculacao de indicacao nunca funciona** -- falha silenciosamente.

O metodo `processCommission()` tambem e codigo morto -- tenta INSERT em `referral_commissions` que tem grants SELECT-only.

**Solucao**: Criar Edge Function `link-referral` que:
1. Recebe `referral_code` no body
2. Valida o JWT do usuario
3. Usa `service_role` para fazer o UPDATE na tabela `referrals`
4. Retorna sucesso/erro

Atualizar `AuthPage.tsx` para chamar a Edge Function em vez de `ReferralService.linkReferral()`.

Remover `processCommission()` de `ReferralService.ts` (ja e feito via trigger `process_referral_commission` no banco).

---

## Vulnerabilidade 3: referral_settings com grants de escrita (MEDIA)

**Problema**: A tabela `referral_settings` tem grants `arwdDxtm` (escrita completa) para o role `authenticated`. Embora a RLS exija admin, os grants deveriam ser SELECT-only como defesa em profundidade, seguindo o padrao do projeto.

**Solucao**: Migration SQL para revogar INSERT/UPDATE/DELETE do `authenticated` e `anon`.

---

## Vulnerabilidade 4: Metodo updateSettings() client-side (BAIXA)

**Problema**: `ReferralService.updateSettings()` faz UPDATE em `referral_settings` direto do client. A RLS protege (exige admin), mas apos revogar os grants (Vuln 3) este metodo parara de funcionar mesmo para admins.

**Solucao**: Manter o metodo pois admins autenticados passam pela RLS. Apos revogar grants, este metodo tambem se tornara codigo morto e devera ser migrado para Edge Function.

Alternativa mais limpa: ja revogar os grants e migrar para Edge Function de uma vez.

---

## Sequencia de Implementacao

### Passo 1: Migration SQL (uma unica migration)

```text
-- 1. Trigger para proteger copy_subscriptions
CREATE OR REPLACE FUNCTION protect_copy_subscription_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Follower so pode alterar configuracoes de copia
  NEW.status := OLD.status;
  NEW.cancelled_at := OLD.cancelled_at;
  NEW.total_trades_copied := OLD.total_trades_copied;
  NEW.total_profit := OLD.total_profit;
  NEW.total_commission_paid := OLD.total_commission_paid;
  NEW.monthly_fee_paid := OLD.monthly_fee_paid;
  NEW.last_payment_at := OLD.last_payment_at;
  NEW.current_period_start := OLD.current_period_start;
  NEW.current_period_end := OLD.current_period_end;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.payment_method := OLD.payment_method;
  NEW.trader_id := OLD.trader_id;
  NEW.follower_id := OLD.follower_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_copy_subscription_fields_trigger
  BEFORE UPDATE ON copy_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION protect_copy_subscription_fields();

-- 2. Revogar grants de escrita em referral_settings
REVOKE INSERT, UPDATE, DELETE ON public.referral_settings
  FROM anon, authenticated;
```

### Passo 2: Edge Function link-referral

Nova Edge Function que:
- Recebe `{ referral_code: string }` no body
- Autentica o usuario via JWT
- Busca o referral pelo codigo (service_role)
- Valida que nao e auto-referral
- Faz o UPDATE vinculando referred_id e discount_expires_at
- Retorna sucesso/erro

### Passo 3: Limpeza de codigo

- Remover `processCommission()` de `ReferralService.ts` (codigo morto, ja feito via trigger no banco)
- Remover `linkReferral()` de `ReferralService.ts` (substituido pela Edge Function)
- Atualizar `AuthPage.tsx` para chamar `supabase.functions.invoke('link-referral', ...)` 
- Remover `updateSettings()` de `ReferralService.ts` (bloqueado apos revogar grants, criar Edge Function `update-referral-settings` para admins)

### Passo 4: Validacao

- Testar que signup com codigo de indicacao funciona via nova Edge Function
- Testar que follower pode alterar auto_copy e max_trade_amount normalmente
- Testar que follower NAO consegue reativar assinatura cancelada via DevTools
- Testar que admin continua gerenciando referral_settings
