# Plano: Corrigir Processamento de Payouts Após Liquidação

## ✅ IMPLEMENTADO

### Alterações Realizadas

1. **Migração SQL aplicada**: `process_market_payouts` agora detecta automaticamente se o resultado é um UUID (mercado multi-opção) ou YES/NO (mercado binário)

2. **UI de Liquidação atualizada** (`AdminSettlementsPage.tsx`):
   - Para mercados BINARY: exibe botões SIM/NÃO
   - Para mercados MULTIPLE: exibe dropdown com as opções do mercado

3. **Hook atualizado** (`useAdminEvents.ts`):
   - `useSettleEvent` agora aceita `result: string` (UUID ou YES/NO)

### Fluxo Corrigido

```text
Admin acessa /admin/settlements
         │
         ▼
   Seleciona mercado
         │
    ┌────┴────┐
    │         │
 BINARY    MULTIPLE
    │         │
    ▼         ▼
 SIM/NÃO   Dropdown de opções
    │         │
    └────┬────┘
         │
         ▼
   Confirma liquidação → process_market_payouts detecta tipo
         │
    ┌────┴────┐
    │         │
 YES/NO    UUID
    │         │
    ▼         ▼
position   option_id match
    │         │
    └────┬────┘
         │
         ▼
   ✅ Wallets creditados
   ✅ Ledger entries criados
   ✅ Notificações enviadas
```

### Lógica de Payouts

**Mercados BINARY:**
- Vencedores: `position = 'YES'` ou `position = 'NO'` conforme resultado

**Mercados MULTIPLE:**
- YES winners: `option_id = UUID vencedor` AND (`contract_type = 'YES'` OR NULL)
- NO winners: `option_id != UUID vencedor` AND `contract_type = 'NO'`
- Perdedores: todos os outros contratos são zerados
