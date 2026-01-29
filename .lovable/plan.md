
# Plano: Restaurar Interface de Compra por Quantidade de Contratos

## Resumo
Modificar o `MinimalTradingCard.tsx` para usar a lógica de entrada por **quantidade de contratos** (como no `PurchaseModal.tsx` antigo) ao invés de entrada por **valor em R$**.

## Mudanças de Experiência do Usuário

**Antes (atual):**
- Usuário digita valor em R$ (ex: R$10,00)
- Sistema calcula quantos contratos pode comprar
- Botões de porcentagem do saldo (25%, 50%, 75%, 100%)

**Depois (restaurado):**
- Usuário escolhe quantidade de contratos (ex: 50 contratos)
- Sistema calcula o custo total
- Botões de seleção rápida (10, 25, 50, 100 contratos)
- Setas de incremento/decremento (+/-)
- Botão "Max" para usar saldo máximo disponível

## Detalhes Técnicos

### Arquivo: `src/components/market/MinimalTradingCard.tsx`

#### 1. Modificar o input e lógica principal
- Trocar input de R$ para quantidade de contratos
- Remover prefixo "R$" do input no modo compra
- Input recebe número de contratos diretamente
- Calcular custo via LMSR baseado na quantidade

#### 2. Substituir botões de porcentagem por botões de quantidade
Trocar os botões `[25%, 50%, 75%, 100%]` por:
- Botões de quantidade rápida: `[10, 25, 50, 100]` contratos
- Botão "Max" que calcula quantos contratos cabem no saldo

#### 3. Adicionar setas de incremento/decremento
Adicionar botões +/- ao lado do input para ajuste fino:
```text
┌─────────────────────────────┐
│ Quantidade       ▲         │
│ [    50    ]     ▼         │
└─────────────────────────────┘
```

#### 4. Atualizar rótulos e labels
- "Valor" → "Quantidade"
- "Saldo: R$X" → permanece para referência
- Mostrar custo calculado claramente abaixo

#### 5. Manter lógica de venda inalterada
O modo "Vender" já usa quantidade de contratos, não precisa de alteração

### Fluxo de cálculo

```text
Usuário digita: 50 contratos
        ↓
LMSR calcula: getQuote(eventId, outcome, 50)
        ↓
Exibe: "Total: R$25.00"
        ↓
Botão: "Comprar Sim - R$25.00"
```

## Componentes Afetados

| Componente | Mudança |
|------------|---------|
| `MinimalTradingCard.tsx` | Modificar lógica de input e botões |
| `MarketsPage.tsx` | Nenhuma (já usa MinimalTradingCard) |
| `MarketDetailPage.tsx` | Nenhuma (já usa MinimalTradingCard) |

## Validações a Manter

- Verificar saldo suficiente
- Aplicar slippage de 5%
- Validar quantidade mínima/máxima
- Mensagens de erro em português
