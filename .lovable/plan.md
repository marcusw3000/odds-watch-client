
# Plano: Suporte a Múltiplos Vencedores em Mercados Multi-Opção

## Visão Geral
Atualmente, mercados multi-opção utilizam um modelo "winner-takes-all" onde apenas **uma opção** pode ser declarada vencedora na liquidação. O objetivo é permitir que o administrador selecione **múltiplos vencedores** (ex: 1º, 2º e 3º lugar) ao liquidar um mercado, distribuindo os prêmios proporcionalmente.

---

## Mudanças Necessárias

### 1. Banco de Dados

**Adicionar coluna para quantidade de vencedores**
- Tabela `markets`: adicionar coluna `max_winners` (INTEGER, default 1)
- Permite configurar quantas opções podem ganhar em cada mercado

**Alterar coluna `result` para suportar múltiplos valores**
- Atualmente armazena um UUID único ou "YES"/"NO"
- Mudará para armazenar um array JSON de UUIDs ordenados por colocação

```text
┌─────────────────────────────────────────────────────────────┐
│ markets                                                     │
├─────────────────────────────────────────────────────────────┤
│ + max_winners: INTEGER DEFAULT 1                            │
│   result: TEXT → armazenará JSON ["uuid1", "uuid2", "uuid3"]│
└─────────────────────────────────────────────────────────────┘
```

---

### 2. Formulário de Criação de Evento (Admin)

**Arquivo**: `src/pages/admin/AdminEventFormPage.tsx`

- Adicionar campo "Quantidade de Vencedores" visível apenas quando `marketType === 'MULTIPLE'`
- Slider ou dropdown com valores: 1, 2, 3, ou "Todos" (raro)
- Atualizar lógica de criação para enviar `maxWinners` ao backend

**Arquivo**: `supabase/functions/create-admin-event/index.ts`

- Aceitar parâmetro `maxWinners` e salvar na coluna `max_winners`

---

### 3. Página de Liquidação (Admin)

**Arquivo**: `src/pages/admin/AdminSettlementsPage.tsx`

Mudanças na interface:
- Quando `max_winners > 1`, trocar o Select único por um componente de **seleção múltipla ordenada**
- Permitir arrastar/ordenar opções para definir 1º, 2º, 3º lugar
- Exibir quantas opções ainda precisam ser selecionadas
- Validar que exatamente `max_winners` opções foram selecionadas

Exemplo visual:
```text
┌───────────────────────────────────────────────────────────┐
│ Selecione os vencedores (3 de 3 necessários)              │
├───────────────────────────────────────────────────────────┤
│ 🥇 1º Lugar: [Competidor Alpha ▼]                         │
│ 🥈 2º Lugar: [Competidor Beta ▼]                          │
│ 🥉 3º Lugar: [Competidor Gamma ▼]                         │
└───────────────────────────────────────────────────────────┘
```

---

### 4. Função SQL de Pagamentos

**Arquivo**: Migração SQL para `process_market_payouts`

Lógica atualizada:
- Receber `p_winning_outcome` como JSON array ordenado
- Processar pagamentos baseados na **colocação**:
  - 1º lugar: 100% do prêmio base
  - 2º lugar: X% (ex: 60%)
  - 3º lugar: Y% (ex: 30%)
  - Ou distribuição configurável

**Contratos YES**: ganham se apostaram na opção vencedora (qualquer colocação)
**Contratos NO**: ganham se apostaram CONTRA uma opção que NÃO ficou em nenhuma colocação

```text
Exemplo com 3 vencedores (A, B, C):
┌─────────────────────────────────────────────────────────┐
│ Contrato YES em A (1º) → Ganha 100% × shares           │
│ Contrato YES em B (2º) → Ganha 60% × shares            │
│ Contrato YES em C (3º) → Ganha 30% × shares            │
│ Contrato YES em D      → Perde tudo                    │
│ Contrato NO em D       → Ganha (D perdeu)              │
│ Contrato NO em A       → Perde (A ganhou)              │
└─────────────────────────────────────────────────────────┘
```

---

### 5. Exibição de Resultados

**Arquivos de Cards**: 
- `CardStyleDefault.tsx`
- `CardStyleMinimal.tsx`
- `CardStyleButtons.tsx`
- `CardStyleSimple.tsx`

**Arquivo de Detalhe**: `MarketDetailPage.tsx`

Mudanças:
- Detectar quando `result` é um array JSON
- Exibir badges com colocação (🥇 🥈 🥉) para cada vencedor
- Mostrar "1º", "2º", "3º" ao lado do label da opção

**Arquivo**: `src/components/market/MarketStatusBadge.tsx`

- Atualizar para renderizar múltiplos resultados quando aplicável

---

### 6. Edge Functions

**Arquivo**: `supabase/functions/update-admin-event/index.ts`

- Aceitar `result` como string ou array de strings
- Converter para JSON ao salvar
- Chamar `process_market_payouts` com o array

---

## Resumo de Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| Migração SQL | Nova coluna + função atualizada |
| `create-admin-event/index.ts` | Aceitar `maxWinners` |
| `update-admin-event/index.ts` | Aceitar array de `result` |
| `AdminEventFormPage.tsx` | Campo de quantidade de vencedores |
| `AdminSettlementsPage.tsx` | Seleção múltipla ordenada |
| `process_market_payouts` (SQL) | Lógica para múltiplos vencedores |
| `MarketStatusBadge.tsx` | Exibir múltiplos resultados |
| Cards (4 arquivos) | Mostrar badges de colocação |
| `MarketDetailPage.tsx` | Exibir ranking de vencedores |
| `src/types/market.ts` | Atualizar tipo `result` |

---

## Seção Técnica

### Migração SQL

```sql
-- Adicionar coluna para quantidade máxima de vencedores
ALTER TABLE markets ADD COLUMN max_winners INTEGER DEFAULT 1;

-- A coluna result já é TEXT, então pode armazenar JSON
-- Ex: '["uuid1", "uuid2", "uuid3"]' ou "YES" (binário)
```

### Interface TypeScript

```typescript
// Atualização em src/types/market.ts
interface MarketEvent {
  // ...
  result?: 'YES' | 'NO' | string | string[]; // Pode ser array de UUIDs
  maxWinners?: number;
}
```

### Parsing de Resultado

```typescript
// Utilitário para normalizar resultado
function parseResult(result: string | null): string[] {
  if (!result) return [];
  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [result];
  } catch {
    return [result]; // "YES", "NO", ou UUID único
  }
}
```

### Distribuição de Prêmios (Exemplo)

| Colocação | Multiplicador |
|-----------|---------------|
| 1º lugar  | 1.00 (100%)   |
| 2º lugar  | 0.60 (60%)    |
| 3º lugar  | 0.30 (30%)    |

Estes valores podem ser configuráveis por mercado ou globais.

---

## Considerações

1. **Compatibilidade**: Mercados existentes com `max_winners = 1` continuam funcionando normalmente
2. **Contratos NO**: A lógica de NO precisa considerar que "perder" significa não estar em NENHUMA colocação
3. **Rake**: A taxa de 0.5% continua aplicável sobre todos os prêmios
4. **Auditoria**: Cada pagamento registra a colocação no campo `meta` do ledger
