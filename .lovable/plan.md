

# Corrigir Vulnerabilidade de Booleans Interceptaveis em `profiles`

## Problema

A tabela `profiles` permite UPDATE pelo proprio usuario (`auth.uid() = id`), porem **todos os campos** ficam editaveis, incluindo booleans sensiveis como `is_blocked` e `is_copy_trader`. Um usuario pode manipular esses valores diretamente via console do navegador.

### Campos Vulneraveis

- **is_blocked** (CRITICO): usuario bloqueado pode se desbloquear
- **is_copy_trader** (ALTO): usuario pode pular o fluxo de aprovacao
- **has_night_trade, has_early_trade, has_speed_trade, has_contrarian_trade** (MEDIO): inflar conquistas

### Campos Seguros (preferencias do usuario)

- is_public, show_profit, show_roi, show_trades, show_volume

## Solucao: Trigger BEFORE UPDATE

Criar uma trigger PostgreSQL que, quando o usuario (nao-admin) tenta fazer UPDATE no proprio perfil, **reseta automaticamente os campos protegidos** ao valor original, impedindo manipulacao.

Essa abordagem:
- Nao quebra nenhuma funcionalidade existente
- Permite que admins continuem editando todos os campos
- Permite que Edge Functions com service_role continuem atualizando stats
- E transparente para o usuario (o UPDATE "funciona" mas os campos protegidos nao mudam)

## Detalhes Tecnicos

### Migration SQL

Criar uma funcao e trigger:

```text
CREATE FUNCTION protect_profile_fields()
  -- Se o usuario atual NAO e admin e esta editando o proprio perfil:
  --   NEW.is_blocked = OLD.is_blocked
  --   NEW.is_copy_trader = OLD.is_copy_trader
  --   NEW.copy_trader_id = OLD.copy_trader_id
  --   NEW.blocked_at = OLD.blocked_at
  --   NEW.blocked_by = OLD.blocked_by
  --   NEW.blocked_reason = OLD.blocked_reason
  --   NEW.has_night_trade = OLD.has_night_trade
  --   NEW.has_early_trade = OLD.has_early_trade
  --   NEW.has_speed_trade = OLD.has_speed_trade
  --   NEW.has_contrarian_trade = OLD.has_contrarian_trade
  --   NEW.total_trades = OLD.total_trades
  --   NEW.winning_trades = OLD.winning_trades
  --   NEW.total_profit = OLD.total_profit
  --   NEW.total_volume = OLD.total_volume
  --   NEW.roi_percent = OLD.roi_percent
  --   NEW.current_streak = OLD.current_streak
  --   NEW.best_streak = OLD.best_streak
  --   NEW.best_trade_profit = OLD.best_trade_profit
  --   NEW.markets_won_streak = OLD.markets_won_streak
  --   NEW.best_markets_won_streak = OLD.best_markets_won_streak
  --   NEW.weekend_trades = OLD.weekend_trades
  --   NEW.total_referrals = OLD.total_referrals
  --   NEW.activated_referrals = OLD.activated_referrals
  --   NEW.total_referral_commission = OLD.total_referral_commission
  --   NEW.suggestions_created = OLD.suggestions_created
  --   NEW.suggestions_approved = OLD.suggestions_approved
  --   NEW.suggestions_implemented = OLD.suggestions_implemented
  --   NEW.best_suggestion_score = OLD.best_suggestion_score
  -- Admins e service_role passam sem restricao

CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_fields();
```

### Campos protegidos (usuario nao pode alterar)

**Moderacao**: is_blocked, blocked_at, blocked_by, blocked_reason
**Copy Trade**: is_copy_trader, copy_trader_id
**Estatisticas**: total_trades, winning_trades, total_profit, total_volume, roi_percent, current_streak, best_streak, best_trade_profit, markets_won_streak, best_markets_won_streak, weekend_trades
**Conquistas**: has_night_trade, has_early_trade, has_speed_trade, has_contrarian_trade
**Referrals**: total_referrals, activated_referrals, total_referral_commission
**Sugestoes**: suggestions_created, suggestions_approved, suggestions_implemented, best_suggestion_score

### Campos permitidos (usuario pode alterar)

display_name, full_name, bio, avatar_url, phone, email, cpf, is_public, show_profit, show_roi, show_trades, show_volume

### Impacto

- Zero mudanca no frontend (updates de perfil continuam funcionando normalmente)
- Edge Functions com service_role nao sao afetadas (trigger verifica role)
- Admins nao sao afetados (trigger verifica has_role)
- Apenas manipulacao direta pelo usuario e bloqueada

