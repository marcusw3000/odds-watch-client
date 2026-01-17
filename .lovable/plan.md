# Plano de Correcao - Bugs de Alta Prioridade

## Objetivo
Corrigir 3 bugs identificados na analise:
1. Filtro CONTESTED ausente
2. Inconsistencia Ledger/Wallet
3. Calculo de lucro potencial incorreto

---

## Correcao 1: Adicionar CONTESTED ao Filtro

**Arquivo**: `src/components/market/AdvancedFilters.tsx`

**Linha 45 atual**:
```typescript
const statusOptions: MarketStatus[] = ['OPEN', 'HALTED', 'PENDING', 'SETTLED'];
```

**Alterar para**:
```typescript
const statusOptions: MarketStatus[] = ['OPEN', 'HALTED', 'PENDING', 'CONTESTED', 'SETTLED'];
```

---

## Correcao 2: Ledger Entries para Depositos/Saques

**Nova migracao SQL** para atualizar as funcoes atomicas:

### atomic_deposit_balance
- Apos atualizar o saldo, criar um `ledger_entry` com:
  - direction: 'CREDIT'
  - ref_type: 'DEPOSIT'
  - status: 'COMPLETED'

### atomic_withdraw_balance
- Apos atualizar o saldo, criar um `ledger_entry` com:
  - direction: 'DEBIT'
  - ref_type: 'WITHDRAWAL'
  - status: 'COMPLETED'

---

## Correcao 3: Calculo de P&L Real

**Arquivo**: `src/components/portfolio/ContractsList.tsx`

### Mudancas:
1. Adicionar estado para armazenar precos atuais de mercado
2. Buscar precos ao montar o componente (para contratos ativos)
3. Calcular P&L usando:
   - Valor atual = (preco_atual / 100) x quantidade
   - Custo = (preco_compra / 100) x quantidade
   - P&L = Valor atual - Custo
4. Mostrar P&L com cores (verde para lucro, vermelho para prejuizo)
5. Adicionar loading state enquanto busca precos

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/market/AdvancedFilters.tsx` | Adicionar 'CONTESTED' |
| Nova migracao SQL | Criar ledger entries |
| `src/components/portfolio/ContractsList.tsx` | Calcular P&L real |

---

## Resultado Esperado
- Usuarios podem filtrar mercados em contestacao
- Depositos e saques criam registros de auditoria
- Portfolio mostra lucro/prejuizo real baseado no preco atual de mercado
