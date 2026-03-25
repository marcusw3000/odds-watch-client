

# Remover Slider do MultiOptionPurchaseModal

## Problema
O `MultiOptionPurchaseModal` tem um `Slider` entre o input de valor e os botões rápidos, mas o padrão visual de referência (screenshot) e o `TradingModal` não usam slider — apenas input R$ + botões rápidos (+R$10, +R$50, +R$100, Max).

## Mudança

### `src/components/market/MultiOptionPurchaseModal.tsx`
- Remover o import do `Slider`
- Remover o bloco do Slider (linhas 350-360) que renderiza `<Slider value={[amountNum]} ... />`
- Manter input R$ + botões rápidos intactos

**1 arquivo, ~12 linhas removidas.**

