

# Padronização dos Modais de Trading

## Problema

Existem **5 modais de trading** com estilos e padrões visuais inconsistentes:

1. **TradingModal** — modal unificado compra/venda para binários (mais moderno, com tabs, R$ como input, "Para ganhar")
2. **PurchaseModal** — modal de compra binário (legado, input por contratos, OddsBadge, timer)
3. **SellModal** — modal de venda binário (usa ResponsiveModal, countdown de confirmação)
4. **MultiOptionPurchaseModal** — modal de compra multi-opção (input por contratos, timer, sem tabs)
5. **MultiOptionSellModal** — modal de venda multi-opção (Dialog/Drawer, seleção de contrato)

O `TradingModal` é o mais alinhado com o padrão da concorrência (screenshot): R$ como input primário, botões SIM/NÃO com preço em centavos, "Para ganhar", layout limpo. Mas os modais multi-opção e os legados binários não seguem esse padrão.

## Solução

Padronizar **MultiOptionPurchaseModal** para seguir o mesmo layout do `TradingModal`:

### Mudanças no `MultiOptionPurchaseModal.tsx`

1. **Input por valor (R$)** ao invés de contratos — calcular contratos automaticamente como `amount / (price / 100)`
2. **Tabs SIM/NÃO** no topo com preço em centavos (como o screenshot: "Sim 65¢" / "Não 35¢"), substituindo a seção "Sua posição"
3. **Slider visual** para ajustar o valor (referência do screenshot) com botões rápidos de porcentagem (25%, 50%, 75%, 100% do saldo)
4. **"Para ganhar"** com valor destacado em verde, como no TradingModal
5. **Remover timer de expiração** — usar refresh sob demanda como o TradingModal
6. **Botão de confirmação** colorido (verde para SIM, vermelho para NÃO) com texto "Comprar Sim/Não"
7. **Header** com avatar + nome da opção + "Comprar Sim/Não" em subtítulo colorido

### Mudanças no `MultiOptionSellModal.tsx`

1. **Alinhar layout** com o TradingModal modo sell: input por contratos, botões de porcentagem (25%, 50%, 75%, 100%)
2. **Remover timer** — refresh sob demanda
3. **"Você receberá"** com destaque, lucro/prejuízo com cores

### Arquivos alterados

- `src/components/market/MultiOptionPurchaseModal.tsx` — refatoração completa do layout
- `src/components/market/MultiOptionSellModal.tsx` — alinhamento visual com TradingModal

### Detalhes técnicos

- O cálculo LMSR permanece igual, apenas o input muda de contratos para R$
- `sharesFromAmount = Math.floor(amountNum / (currentPrice / 100))` para calcular contratos a partir do valor
- `potentialWin = sharesFromAmount * 1` (R$1 por contrato vencedor)
- Slider usa `<Slider>` do shadcn com range de 0 a `Math.min(userBalance, event.limits.maxBuy)`
- As tabs SIM/NÃO recalculam `currentPrice` baseado no `side` selecionado

**2 arquivos, ~200 linhas alteradas.**

