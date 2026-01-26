
## Suavização de Preços com Liquidez Configurável (Estilo Kalshi/Polymarket)

### Problema Identificado

Atualmente, quando um mercado é criado e alguém compra contratos, o preço balança drasticamente:

| Mercado | lmsr_b | YES shares | NO shares | Preço YES |
|---------|--------|------------|-----------|-----------|
| Teste LMSR | 100 | 727 | 99 | **99.81%** |
| iabadabadu | 100 | 662 | 0 | **99.87%** |

Com `lmsr_b = 100`, uma compra de ~R$100 já move o preço de 50% para extremos.

### Como Kalshi e Polymarket Resolvem

1. **Parâmetro de Liquidez Maior**: Kalshi usa valores de `b` entre 250-1000 dependendo do volume esperado
2. **Liquidez Dinâmica (LS-LMSR)**: O parâmetro `b` aumenta automaticamente com o volume de trades
3. **Virtual Shares**: Inicializar mercados com "shares virtuais" nos dois lados para ancorar o preço

### Solução Proposta

Implementar um sistema híbrido com 3 níveis de liquidez configuráveis pelo admin:

```text
+------------------------+--------+------------------+----------------------+
| Nível                  | lmsr_b | Impacto R$100    | Uso Recomendado      |
+------------------------+--------+------------------+----------------------+
| Baixa (sensível)       | 100    | ±15-20%          | Mercados de nicho    |
| Média (padrão)         | 300    | ±5-8%            | Mercados regulares   |
| Alta (estável)         | 500    | ±3-5%            | Mercados populares   |
+------------------------+--------+------------------+----------------------+
```

---

### Arquitetura da Implementação

```text
+-------------------------+     +-------------------------+
|  AdminEventFormPage.tsx |     |  create-admin-event.ts  |
|  (Selector de Liquidez) | --> |  (Recebe lmsr_b)        |
+-------------------------+     +-------------------------+
           |                              |
           v                              v
+-------------------------+     +-------------------------+
|  Preview de Impacto     |     |  markets table          |
|  (Simulação visual)     |     |  (lmsr_b configurável)  |
+-------------------------+     +-------------------------+
```

---

### Fase 1: Adicionar Seletor de Liquidez no Formulário Admin

Adicionar um novo campo no formulário de criação de eventos para selecionar o nível de liquidez:

**Arquivo:** `src/pages/admin/AdminEventFormPage.tsx`

- Adicionar estado `liquidityLevel` com opções: `low`, `medium`, `high`
- Mapear para valores de `lmsr_b`: 100, 300, 500
- Mostrar tooltip explicativo sobre o impacto

**UI proposta:**
```text
┌─────────────────────────────────────────────────────┐
│ Liquidez do Mercado                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│ │  Baixa  │ │ ● Média │ │  Alta   │                │
│ │  (100)  │ │  (300)  │ │  (500)  │                │
│ └─────────┘ └─────────┘ └─────────┘                │
│                                                     │
│ ⓘ Média: Uma compra de R$100 move o preço ~6%      │
│    Ideal para mercados com volume moderado          │
└─────────────────────────────────────────────────────┘
```

---

### Fase 2: Preview de Impacto de Preço

Adicionar componente visual que mostra o impacto simulado:

**Novo componente:** `src/components/admin/LiquidityPreview.tsx`

Exibe uma simulação interativa mostrando:
- Preço inicial configurado (ex: 50%)
- Preço após compra hipotética de R$100
- Visualização gráfica da "curva" de liquidez

---

### Fase 3: Atualizar Edge Function

**Arquivo:** `supabase/functions/create-admin-event/index.ts`

Modificar para aceitar o parâmetro `liquidity` ou `lmsr_b` no payload:

```typescript
// Antes (fixo)
const lmsrB = 100;

// Depois (configurável)
const liquidityMap = { low: 100, medium: 300, high: 500 };
const lmsrB = liquidityMap[body.liquidity] || 300; // Default: medium
```

---

### Fase 4: Atualizar Edge Function de Update

**Arquivo:** `supabase/functions/update-admin-event/index.ts`

Permitir que admins ajustem a liquidez de mercados existentes (com aviso sobre impacto em trades futuros).

---

### Fase 5: Adicionar Indicador Visual nos Cards

Mostrar o nível de liquidez nos cards do admin para contexto:

**Arquivo:** `src/pages/admin/AdminEventsPage.tsx`

Badge indicando: "🌊 Alta liquidez" ou "💧 Baixa liquidez"

---

### Arquivos a Modificar

| Ação | Arquivo |
|------|---------|
| **Modificar** | `src/pages/admin/AdminEventFormPage.tsx` |
| **Criar** | `src/components/admin/LiquidityPreview.tsx` |
| **Modificar** | `supabase/functions/create-admin-event/index.ts` |
| **Modificar** | `supabase/functions/update-admin-event/index.ts` |
| **Modificar** | `src/pages/admin/AdminEventsPage.tsx` |
| **Modificar** | `src/hooks/useAdminEvents.ts` (tipos) |

---

### Detalhes Técnicos

**Fórmula do Impacto de Preço:**

Para simular o impacto de uma compra de R$X no formulário:

```typescript
function simulatePriceImpact(
  initialPrice: number, // 0.5 = 50%
  buyAmount: number,    // R$100
  lmsrB: number         // 100, 300, ou 500
): number {
  const state: LMSRState = {
    b: lmsrB,
    qYes: lmsrB * Math.log(initialPrice / (1 - initialPrice)),
    qNo: 0,
  };
  
  const shares = getSharesForCost(state, 'YES', buyAmount);
  const newState = executeBuy(state, 'YES', shares);
  const newPrice = getPriceYes(newState);
  
  return newPrice - (initialPrice * 100);
}
```

**Exemplos de Impacto (compra de R$100 em mercado 50/50):**

| lmsr_b | Shares compradas | Novo preço YES | Variação |
|--------|------------------|----------------|----------|
| 100    | ~143 shares      | 78%            | +28%     |
| 300    | ~189 shares      | 62%            | +12%     |
| 500    | ~208 shares      | 57%            | +7%      |

---

### Tipos TypeScript

```typescript
// Em types/admin.ts ou similar
export type LiquidityLevel = 'low' | 'medium' | 'high';

export const LIQUIDITY_CONFIG = {
  low: { b: 100, label: 'Baixa', description: 'Preços sensíveis, ideal para nichos' },
  medium: { b: 300, label: 'Média', description: 'Equilíbrio entre sensibilidade e estabilidade' },
  high: { b: 500, label: 'Alta', description: 'Preços estáveis, ideal para alto volume' },
} as const;
```

---

### Considerações Importantes

1. **Trade-off de Liquidez**: Maior `b` = preços mais estáveis, mas menor reação a novas informações
2. **Subsídio da Plataforma**: O "custo" da liquidez é arcado pela plataforma (perda máxima = b * ln(2) para mercados binários)
3. **Migração**: Mercados existentes manterão `lmsr_b = 100` a menos que sejam editados
4. **Default Recomendado**: Mudar de `100` para `300` como padrão para novos mercados

---

### Benefícios

- Preços mais estáveis em novos mercados
- Admin tem controle sobre a "profundidade" de cada mercado
- Melhor experiência para usuários (menos oscilações bruscas)
- Alinhamento com práticas de Kalshi e Polymarket
