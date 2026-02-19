

# Plano de Mitigacao de Vulnerabilidades via DevTools

## Resumo

Este plano cobre 4 vulnerabilidades identificadas que podem ser exploradas via DevTools/console do navegador, organizadas por criticidade.

---

## Vulnerabilidade 1: Campos protegidos em `profiles` (CRITICA)

**Problema**: A policy RLS `auth.uid() = id` permite que o usuario edite qualquer coluna do proprio perfil, incluindo `is_blocked`, `is_copy_trader`, estatisticas e conquistas.

**Solucao**: Criar uma trigger `BEFORE UPDATE` que reseta campos protegidos ao valor original quando o usuario nao e admin nem service_role.

**Migration SQL**:
- Funcao `protect_profile_fields()` com `SECURITY DEFINER`
- Verifica se `current_setting('role')` e `service_role` (passa direto)
- Verifica se o usuario tem role `admin` via `has_role()` (passa direto)
- Para usuarios comuns: forca `NEW.campo = OLD.campo` nos 27 campos protegidos
- Campos protegidos: is_blocked, blocked_at, blocked_by, blocked_reason, is_copy_trader, copy_trader_id, todas as estatisticas, conquistas, referrals e sugestoes
- Campos permitidos: display_name, full_name, bio, avatar_url, phone, email, cpf, is_public, show_profit, show_roi, show_trades, show_volume

---

## Vulnerabilidade 2: Auto-aprovacao em `copy_traders` (ALTA)

**Problema**: A policy RLS de UPDATE permite `user_id = auth.uid()`, ou seja, o usuario pode fazer `update({ status: 'APPROVED' })` no proprio registro.

**Solucao**: Criar uma trigger `BEFORE UPDATE` na tabela `copy_traders` que impede o usuario de alterar campos administrativos.

**Migration SQL**:
- Funcao `protect_copy_trader_fields()` com `SECURITY DEFINER`
- Campos protegidos (somente admin/service_role pode alterar): status, approved_by, approved_at, rejection_reason, suspended_at, custom_trader_split, custom_platform_split, total_followers, total_trades_copied, total_earnings, win_rate
- Campos permitidos (trader pode alterar): display_name, bio, avatar_url, monthly_fee, profit_share_percent, stripe_product_id, stripe_price_id

---

## Vulnerabilidade 3: Metodos de escrita "mortos" no client-side (MEDIA)

**Problema**: `FinancialRepository.ts` contem metodos `createWallet()` e `adjustWalletBalance()` que tentam escrever em `wallets` e `ledger_entries`. Embora os grants de banco bloqueiem a execucao, manter esses metodos no codigo:
- Confunde desenvolvedores sobre a arquitetura real
- Pode mascarar erros silenciosos (falha sem feedback claro)

**Solucao**: Remover os metodos `createWallet()` (linhas 268-281) e `adjustWalletBalance()` (linhas 283-325) do `FinancialRepository.ts`. Essas operacoes ja sao feitas exclusivamente via Edge Functions (`adjust-wallet-balance`, `create-deposit`).

---

## Vulnerabilidade 4: Notificacoes falsas via client-side INSERT (BAIXA)

**Problema**: `NotificationService.ts` usa `supabase.from('notifications').insert()` direto do client. A policy RLS permite `auth.uid() = user_id`, entao um usuario pode criar notificacoes falsas no proprio feed (ex: "Deposito Confirmado R$1000").

**Analise de risco**: O impacto real e baixo porque:
- O usuario so pode criar notificacoes para si mesmo
- Nao afeta saldo, trades ou outros usuarios
- Notificacoes falsas nao enganam o sistema, apenas o proprio feed

**Solucao recomendada**: Nao e urgente. Futuramente, migrar a criacao de notificacoes para Edge Functions. Por agora, documentar como risco aceito.

---

## Sequencia de Implementacao

1. **Migration SQL** (uma unica migration com as duas triggers):
   - `protect_profile_fields()` + trigger
   - `protect_copy_trader_fields()` + trigger

2. **Limpeza de codigo**:
   - Remover `createWallet()` e `adjustWalletBalance()` de `FinancialRepository.ts`
   - Verificar que nenhum codigo chama esses metodos antes de remover

3. **Validacao**:
   - Testar que updates de perfil (nome, bio, avatar) continuam funcionando
   - Testar que admin pode alterar `is_blocked` e `status` normalmente
   - Testar que Edge Functions de trade/settlement continuam atualizando stats

## Detalhes Tecnicos da Migration

```text
-- Funcao 1: Proteger campos do perfil
CREATE OR REPLACE FUNCTION protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypassa completamente
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins podem editar tudo
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Usuario comum: resetar campos protegidos
  -- Moderacao
  NEW.is_blocked := OLD.is_blocked;
  NEW.blocked_at := OLD.blocked_at;
  NEW.blocked_by := OLD.blocked_by;
  NEW.blocked_reason := OLD.blocked_reason;
  -- Copy Trade
  NEW.is_copy_trader := OLD.is_copy_trader;
  NEW.copy_trader_id := OLD.copy_trader_id;
  -- Estatisticas (27 campos no total)
  NEW.total_trades := OLD.total_trades;
  NEW.winning_trades := OLD.winning_trades;
  NEW.total_profit := OLD.total_profit;
  NEW.total_volume := OLD.total_volume;
  NEW.roi_percent := OLD.roi_percent;
  NEW.current_streak := OLD.current_streak;
  NEW.best_streak := OLD.best_streak;
  NEW.best_trade_profit := OLD.best_trade_profit;
  NEW.markets_won_streak := OLD.markets_won_streak;
  NEW.best_markets_won_streak := OLD.best_markets_won_streak;
  NEW.weekend_trades := OLD.weekend_trades;
  -- Conquistas
  NEW.has_night_trade := OLD.has_night_trade;
  NEW.has_early_trade := OLD.has_early_trade;
  NEW.has_speed_trade := OLD.has_speed_trade;
  NEW.has_contrarian_trade := OLD.has_contrarian_trade;
  -- Referrals
  NEW.total_referrals := OLD.total_referrals;
  NEW.activated_referrals := OLD.activated_referrals;
  NEW.total_referral_commission := OLD.total_referral_commission;
  -- Sugestoes
  NEW.suggestions_created := OLD.suggestions_created;
  NEW.suggestions_approved := OLD.suggestions_approved;
  NEW.suggestions_implemented := OLD.suggestions_implemented;
  NEW.best_suggestion_score := OLD.best_suggestion_score;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_fields();

-- Funcao 2: Proteger campos do copy_traders
CREATE OR REPLACE FUNCTION protect_copy_trader_fields()
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

  -- Trader nao pode alterar campos administrativos
  NEW.status := OLD.status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.suspended_at := OLD.suspended_at;
  NEW.custom_trader_split := OLD.custom_trader_split;
  NEW.custom_platform_split := OLD.custom_platform_split;
  NEW.total_followers := OLD.total_followers;
  NEW.total_trades_copied := OLD.total_trades_copied;
  NEW.total_earnings := OLD.total_earnings;
  NEW.win_rate := OLD.win_rate;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_copy_trader_fields_trigger
  BEFORE UPDATE ON copy_traders
  FOR EACH ROW
  EXECUTE FUNCTION protect_copy_trader_fields();
```

### Limpeza de Codigo

Remover de `FinancialRepository.ts`:
- Metodo `createWallet()` (linhas 268-281)
- Metodo `adjustWalletBalance()` (linhas 283-325)

Verificar que nenhum outro arquivo importa/chama esses metodos diretamente (o ajuste de saldo ja usa a Edge Function `adjust-wallet-balance`).

