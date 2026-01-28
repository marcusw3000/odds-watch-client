
# Correção da Taxa de Liquidação Dinâmica

## Problema Atual

| Aspecto | Atual (Hardcoded) | Configurado (fee_rules) |
|---------|-------------------|-------------------------|
| Taxa | 5% | 0.5% |
| Origem | `v_rake_percent := 0.05` | `SELECT * FROM fee_rules WHERE type = 'SETTLEMENT'` |
| Tipo Revenue | `SETTLEMENT_RAKE` | `SETTLEMENT` |
| Snapshot | Não registrado | Não registrado |

**Impacto**: Usuários estão sendo cobrados **10x mais** do que o configurado pelo admin.

---

## Solução: Migração SQL

Atualizar a função `process_market_payouts` para:

1. **Buscar taxa dinâmica** do `fee_rules` ao invés de usar valor hardcoded
2. **Criar snapshot de política** em `fee_policy_snapshots` para auditoria
3. **Gravar fee nos ledger_entries** de cada pagamento individual
4. **Usar tipo consistente** `SETTLEMENT` na `platform_revenue`

---

## Alterações Técnicas

### Nova Lógica de Fee

```sql
DECLARE
  v_fee_rule RECORD;
  v_fee_percent NUMERIC := 0.005; -- Default 0.5% if no rule
  v_fee_snapshot_id UUID;

-- Buscar regra de taxa ativa para SETTLEMENT
SELECT * INTO v_fee_rule 
FROM fee_rules 
WHERE type = 'SETTLEMENT' AND is_active = true 
ORDER BY effective_from DESC 
LIMIT 1;

IF FOUND THEN
  -- Usar taxa configurada (PERCENT ou FIXED)
  IF v_fee_rule.mode = 'PERCENT' THEN
    v_fee_percent := COALESCE(v_fee_rule.percent_value, 0.005);
  END IF;
  
  -- Criar snapshot para auditoria
  INSERT INTO fee_policy_snapshots (
    fee_rule_id, type, applied_mode, applied_percent
  ) VALUES (
    v_fee_rule.id, 'SETTLEMENT', v_fee_rule.mode, v_fee_percent
  )
  RETURNING id INTO v_fee_snapshot_id;
END IF;
```

### Cálculo de Payout com Taxa

```sql
-- Para cada pagamento, calcular fee individual
v_gross_payout := v_contract.shares * v_contract_unit * v_payout_ratio;
v_fee_amount := v_gross_payout * v_fee_percent;
v_net_payout := v_gross_payout - v_fee_amount;

-- Creditar apenas o valor líquido
UPDATE wallets 
SET balance_available = balance_available + v_net_payout
WHERE id = v_wallet_id;

-- Ledger entry com fee registrado
INSERT INTO ledger_entries (
  user_id, wallet_id, ref_type, ref_id, direction,
  amount, fee_amount, net_amount, platform_revenue, 
  fee_snapshot_id, status
) VALUES (
  v_contract.user_id, v_wallet_id, 'SETTLEMENT', 
  p_market_id::text, 'CREDIT',
  v_gross_payout, v_fee_amount, v_net_payout, v_fee_amount,
  v_fee_snapshot_id, 'COMPLETED'
);
```

### Revenue Tracking Atualizado

```sql
-- Acumular receita da plataforma com tipo correto
INSERT INTO platform_revenue (day, type, gross, fees, net)
VALUES (
  CURRENT_DATE, 
  'SETTLEMENT',  -- Tipo consistente com fee_rules
  v_total_gross_payouts, 
  v_total_fees_collected, 
  v_total_gross_payouts - v_total_fees_collected
)
ON CONFLICT (day, type) DO UPDATE SET
  gross = platform_revenue.gross + EXCLUDED.gross,
  fees = platform_revenue.fees + EXCLUDED.fees,
  net = platform_revenue.net + EXCLUDED.net,
  updated_at = NOW();
```

---

## Fluxo de Liquidação Corrigido

```text
┌─────────────────────────────────────────────────────────┐
│              PROCESSO DE LIQUIDAÇÃO                     │
├─────────────────────────────────────────────────────────┤
│ 1. Buscar fee_rule SETTLEMENT ativa                     │
│    └── percent_value: 0.5% (configurável)               │
├─────────────────────────────────────────────────────────┤
│ 2. Criar fee_policy_snapshot (auditoria)                │
│    └── Registra regra aplicada no momento              │
├─────────────────────────────────────────────────────────┤
│ 3. Para cada contrato vencedor:                         │
│    ├── Prêmio bruto: shares × R$1.00                    │
│    ├── Taxa: prêmio × 0.5% = R$ X                       │
│    ├── Prêmio líquido: prêmio - taxa                    │
│    └── Crédito na wallet: prêmio líquido                │
├─────────────────────────────────────────────────────────┤
│ 4. Registrar ledger_entry                               │
│    ├── amount: prêmio bruto                             │
│    ├── fee_amount: taxa cobrada                         │
│    ├── net_amount: prêmio líquido                       │
│    └── fee_snapshot_id: referência auditoria            │
├─────────────────────────────────────────────────────────┤
│ 5. Acumular em platform_revenue                         │
│    └── type: 'SETTLEMENT' (consistente)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Exemplo Prático

| Cenário | Taxa 5% (atual) | Taxa 0.5% (corrigido) |
|---------|-----------------|----------------------|
| Prêmio bruto | R$ 100,00 | R$ 100,00 |
| Taxa cobrada | R$ 5,00 | R$ 0,50 |
| Prêmio líquido | R$ 95,00 | R$ 99,50 |
| Receita plataforma | R$ 5,00 | R$ 0,50 |

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/new_migration.sql` | Atualizar função `process_market_payouts` |

---

## Benefícios

- Taxa configurável pelo admin (0.5% atualmente)
- Auditoria completa via `fee_policy_snapshots`
- Ledger entries com valores corretos de fee
- Tipo `SETTLEMENT` consistente em todo o sistema
- Usuários recebem prêmio justo (menos 10x de desconto indevido)
