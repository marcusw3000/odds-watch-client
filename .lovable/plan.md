
# Implementacao Completa do Sistema de Indicacao

## Resumo

Este plano implementa tres funcionalidades criticas para o sistema de referral:

1. **Trigger de ativacao automatica**: Muda status para `ACTIVATED` quando indicado deposita >= R$ 50
2. **Desconto nas taxas**: Aplica 50% de desconto em todas as taxas para indicados ativos (por 30 dias)
3. **Comissoes automaticas**: Credita 10% das taxas ao indicador em cada trade

---

## Arquitetura Atual

| Componente | Status | Localizacao |
|------------|--------|-------------|
| Tabela `referrals` | Existe | Database |
| Tabela `referral_commissions` | Existe | Database |
| Tabela `referral_settings` | Existe | min_deposit=50, commission=10%, discount=50% |
| `ReferralService.ts` | Existe | Frontend service (metodos prontos) |
| Trigger de ativacao | NAO EXISTE | Precisa criar |
| Desconto no FeeEngine | NAO EXISTE | Precisa integrar |
| Comissao automatica | NAO EXISTE | Precisa integrar |

---

## Componente 1: Trigger de Ativacao Automatica

### Logica

Quando um deposito e confirmado em `verify-deposit`:
1. Verificar se usuario e um `referred_id` em algum referral PENDING
2. Verificar se o valor atende `min_deposit_amount` (R$ 50)
3. Se sim, atualizar status para `ACTIVATED` e setar `activated_at`

### Implementacao

Criar funcao SQL que sera chamada apos deposito confirmado:

```sql
CREATE OR REPLACE FUNCTION activate_referral_on_deposit(
  p_user_id UUID,
  p_deposit_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_min_deposit NUMERIC;
BEGIN
  -- Buscar configuracao de deposito minimo
  SELECT min_deposit_amount INTO v_min_deposit 
  FROM referral_settings 
  WHERE is_active = true 
  LIMIT 1;
  
  v_min_deposit := COALESCE(v_min_deposit, 50.00);
  
  -- Verificar se deposito atende minimo
  IF p_deposit_amount < v_min_deposit THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar referral pendente para este usuario
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_user_id
    AND status = 'PENDING'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Ativar o referral
  UPDATE referrals
  SET status = 'ACTIVATED',
      activated_at = NOW()
  WHERE id = v_referral.id;
  
  -- Criar notificacao para o indicador
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_referral.referrer_id,
    'REFERRAL_ACTIVATED',
    'Indicacao Ativada!',
    'Seu indicado fez o primeiro deposito. Voce ganhara comissao em todas as operacoes dele!',
    jsonb_build_object('referral_id', v_referral.id, 'referred_id', p_user_id)
  );
  
  RETURN TRUE;
END;
$$;
```

### Integracao em verify-deposit/index.ts

Apos creditar o deposito, chamar a funcao de ativacao:

```typescript
// Apos: logStep("Balance updated atomically", { amount, feeAmount, netAmount });

// Verificar e ativar referral se aplicavel
const { data: referralActivated } = await supabaseAdmin.rpc(
  'activate_referral_on_deposit',
  { p_user_id: userId, p_deposit_amount: amount }
);

if (referralActivated) {
  logStep("Referral activated for user", { userId });
}
```

---

## Componente 2: Desconto nas Taxas

### Logica

Usuarios indicados com status `ACTIVATED` recebem 50% de desconto em todas as taxas (TRADE, DEPOSIT, WITHDRAW) por 30 dias apos ativacao.

### Implementacao SQL

Criar funcao que retorna o desconto ativo:

```sql
CREATE OR REPLACE FUNCTION get_active_referral_discount(p_user_id UUID)
RETURNS TABLE (
  has_discount BOOLEAN,
  discount_percent NUMERIC,
  referral_id UUID,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS has_discount,
    r.discount_percent,
    r.id AS referral_id,
    r.discount_expires_at AS expires_at
  FROM referrals r
  WHERE r.referred_id = p_user_id
    AND r.status = 'ACTIVATED'
    AND r.discount_expires_at > NOW()
  LIMIT 1;
  
  -- Se nao encontrou, retornar false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::NUMERIC, NULL::UUID, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;
```

### Integracao nas Funcoes Atomicas

Modificar `atomic_execute_trade` para aplicar desconto:

```sql
-- Dentro de atomic_execute_trade, apos calcular v_fee_amount:

-- Verificar desconto de indicacao
SELECT * INTO v_referral_discount
FROM get_active_referral_discount(p_user_id);

IF v_referral_discount.has_discount THEN
  v_original_fee := v_fee_amount;
  v_fee_amount := v_fee_amount * (1 - v_referral_discount.discount_percent);
  v_discount_applied := v_original_fee - v_fee_amount;
END IF;
```

### Integracao em verify-deposit/index.ts

Aplicar desconto na taxa de deposito:

```typescript
// Apos calcular feeAmount

// Verificar desconto de indicacao
const { data: discount } = await supabaseAdmin.rpc(
  'get_active_referral_discount',
  { p_user_id: userId }
);

if (discount?.[0]?.has_discount) {
  const originalFee = feeAmount;
  feeAmount = feeAmount * (1 - discount[0].discount_percent);
  logStep("Referral discount applied", { 
    originalFee, 
    discountPercent: discount[0].discount_percent,
    newFee: feeAmount 
  });
}
```

---

## Componente 3: Comissoes Automaticas

### Logica

Quando um usuario indicado paga taxa em qualquer operacao:
1. Identificar o referral ativo
2. Calcular comissao (10% da taxa)
3. Creditar na wallet do indicador
4. Registrar em `referral_commissions`
5. Atualizar `total_commission_earned` no referral

### Implementacao SQL

```sql
CREATE OR REPLACE FUNCTION process_referral_commission(
  p_referred_id UUID,
  p_fee_amount NUMERIC,
  p_trade_amount NUMERIC,
  p_ledger_entry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_commission_amount NUMERIC;
  v_referrer_wallet_id UUID;
BEGIN
  -- Buscar referral ativo para o usuario
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_referred_id
    AND status = 'ACTIVATED'
  LIMIT 1;
  
  IF NOT FOUND OR p_fee_amount <= 0 THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'No active referral or zero fee');
  END IF;
  
  -- Calcular comissao
  v_commission_amount := p_fee_amount * v_referral.commission_percent;
  
  -- Buscar wallet do indicador
  SELECT id INTO v_referrer_wallet_id
  FROM wallets
  WHERE user_id = v_referral.referrer_id;
  
  IF v_referrer_wallet_id IS NULL THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'Referrer wallet not found');
  END IF;
  
  -- Creditar comissao na wallet do indicador
  UPDATE wallets
  SET balance_available = balance_available + v_commission_amount,
      updated_at = NOW()
  WHERE id = v_referrer_wallet_id;
  
  -- Registrar comissao
  INSERT INTO referral_commissions (
    referral_id, ledger_entry_id, trade_amount, fee_amount, commission_amount
  ) VALUES (
    v_referral.id, p_ledger_entry_id, p_trade_amount, p_fee_amount, v_commission_amount
  );
  
  -- Atualizar total ganho
  UPDATE referrals
  SET total_commission_earned = total_commission_earned + v_commission_amount
  WHERE id = v_referral.id;
  
  -- Criar ledger entry para o indicador
  INSERT INTO ledger_entries (
    user_id, wallet_id, amount, net_amount, direction, 
    ref_type, status, meta
  ) VALUES (
    v_referral.referrer_id, v_referrer_wallet_id, v_commission_amount, 
    v_commission_amount, 'CREDIT', 'ADJUSTMENT', 'COMPLETED',
    jsonb_build_object(
      'type', 'referral_commission',
      'referral_id', v_referral.id,
      'referred_id', p_referred_id,
      'original_fee', p_fee_amount
    )
  );
  
  RETURN jsonb_build_object(
    'processed', true,
    'commission_amount', v_commission_amount,
    'referrer_id', v_referral.referrer_id,
    'referral_id', v_referral.id
  );
END;
$$;
```

### Integracao nas Funcoes Atomicas

Adicionar ao final de `atomic_execute_trade`:

```sql
-- Processar comissao de indicacao (se houver taxa)
IF v_fee_amount > 0 THEN
  PERFORM process_referral_commission(
    p_user_id, 
    v_fee_amount, 
    p_trade_cost, 
    v_ledger_id
  );
END IF;
```

---

## Fluxo Completo

```text
FLUXO DE INDICACAO COMPLETO
===========================

1. USUARIO NOVO SE REGISTRA COM CODIGO
   /auth?ref=ABC123
        |
        v
   ReferralService.linkReferral()
   - Vincula referred_id
   - Define discount_expires_at (+30 dias)
   - Status permanece PENDING
        |
        v
2. USUARIO FAZ PRIMEIRO DEPOSITO >= R$ 50
   verify-deposit -> activate_referral_on_deposit()
        |
        v
   [Status muda para ACTIVATED]
   [Notificacao enviada ao indicador]
        |
        v
3. USUARIO FAZ TRADE/OPERACAO
   atomic_execute_trade() ou verify-deposit()
        |
        +---> get_active_referral_discount()
        |     [Aplica 50% desconto na taxa]
        |
        +---> process_referral_commission()
              [10% da taxa -> wallet do indicador]
              [Registra em referral_commissions]
              [Atualiza total_commission_earned]
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/migrations/new.sql` | Criar 3 funcoes SQL |
| `supabase/functions/verify-deposit/index.ts` | Ativar referral + aplicar desconto |
| Funcoes atomicas (via migracao) | Integrar desconto e comissao |

---

## Configuracoes Atuais (referral_settings)

| Parametro | Valor |
|-----------|-------|
| `min_deposit_amount` | R$ 50,00 |
| `default_commission_percent` | 10% (0.10) |
| `default_discount_percent` | 50% (0.50) |
| `discount_duration_days` | 30 dias |

---

## Beneficios

- Ativacao automatica sem intervencao manual
- Desconto aplicado em tempo real em todas as taxas
- Comissoes creditadas instantaneamente na wallet do indicador
- Auditoria completa via `referral_commissions` e `ledger_entries`
- Sistema configuravel pelo admin via `referral_settings`
