

# Simplificacao do Desconto de Indicacao - Apenas Taxa de Trade

## Problema Atual

O codigo atual aplica desconto de indicacao em duas situacoes:

| Local | Taxa Base | Desconto Aplicado | Necessario? |
|-------|-----------|-------------------|-------------|
| `verify-deposit/index.ts` | 0% (sem taxa) | Sim | NAO |
| `atomic_execute_trade` | Configuravel | Sim | SIM |

Como nao ha taxa de deposito, o codigo de desconto em `verify-deposit` e desnecessario e gera processamento extra.

---

## Alteracoes Propostas

### 1. Remover Logica de Desconto do verify-deposit

Remover as linhas 149-166 que verificam e aplicam desconto em deposito:

```typescript
// REMOVER este bloco:
let discountApplied = 0;
const { data: discount } = await supabaseAdmin.rpc(
  'get_active_referral_discount',
  { p_user_id: userId }
);

if (discount && discount.length > 0 && discount[0].has_discount) {
  const originalFee = feeAmount;
  feeAmount = feeAmount * (1 - discount[0].discount_percent);
  discountApplied = originalFee - feeAmount;
  logStep("Referral discount applied", { ... });
}
```

### 2. Remover Processamento de Comissao em Deposito

Remover as linhas 208-220 que processam comissao baseada na taxa de deposito:

```typescript
// REMOVER este bloco:
if (feeAmount > 0) {
  const { data: commissionResult } = await supabaseAdmin.rpc(
    'process_referral_commission',
    { p_referred_id: userId, p_fee_amount: feeAmount, p_trade_amount: amount }
  );
  ...
}
```

### 3. Manter Ativacao de Referral em Deposito

A chamada `activate_referral_on_deposit` deve permanecer, pois a ativacao ainda depende do primeiro deposito >= R$ 50.

---

## Codigo Final do verify-deposit

```typescript
// Apos calcular fee normalmente (que sera 0):
feeAmount = Math.round(feeAmount * 100) / 100;
const netAmount = amount - feeAmount;

// ...atualizar payment, creditar wallet...

// Manter apenas: Ativacao de referral no primeiro deposito
const { data: referralActivated } = await supabaseAdmin.rpc(
  'activate_referral_on_deposit',
  { p_user_id: userId, p_deposit_amount: amount }
);

if (referralActivated) {
  logStep("Referral activated for user", { userId });
}

// REMOVIDO: desconto na taxa (nao ha taxa)
// REMOVIDO: comissao em deposito (nao ha taxa para gerar comissao)
```

---

## Fluxo de Indicacao Simplificado

```text
FLUXO SIMPLIFICADO
==================

1. USUARIO SE REGISTRA COM CODIGO
   /auth?ref=ABC123
   [Status: PENDING]
        |
        v
2. FAZ PRIMEIRO DEPOSITO >= R$ 50
   verify-deposit -> activate_referral_on_deposit()
   [Status: ACTIVATED]
   [discount_expires_at = NOW + 30 dias]
        |
        v
3. FAZ TRADE (unica operacao com taxa)
   atomic_execute_trade()
        |
        +-- get_active_referral_discount()
        |   [50% desconto na taxa de trade]
        |
        +-- process_referral_commission()
            [10% da taxa -> wallet do indicador]
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/verify-deposit/index.ts` | Remover desconto e comissao |

A logica no `atomic_execute_trade` permanece inalterada - o desconto e comissao continuam funcionando apenas para trades.

---

## Beneficios

- Codigo mais limpo e sem logica desnecessaria
- Performance melhorada em depositos
- Clareza: desconto se aplica apenas a trades
- Comissao gerada apenas quando ha taxa real

