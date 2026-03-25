

# Remover Slider do MinimalTradingCard

## Problema
O `MinimalTradingCard.tsx` (modal de compra/venda para mercados binários) ainda tem um `Slider` visual. O usuário quer padronizar removendo o slider e mantendo apenas o input R$ + botões de porcentagem (25%, 50%, 75%, 100%).

## Mudança

### `src/components/market/MinimalTradingCard.tsx`
- Remover import do `Slider`
- Remover estados `sliderValue` e `isSliderDragging`
- Remover o bloco visual do Slider (linhas 374-398) — manter os botões de porcentagem (25%, 50%, 75%, 100%) e o aviso de saldo
- Simplificar `handleSliderChange` para receber apenas porcentagem dos botões (renomear para `handlePercentageClick`)
- Remover sync do slider no `handleAmountChange`

**1 arquivo, ~30 linhas removidas/simplificadas.**

