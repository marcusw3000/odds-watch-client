
# Plano: Exibir Tela de Compartilhamento Após Compra

## Problema Identificado
Quando uma compra é realizada com sucesso, o modal de trading é fechado antes de exibir a tela de compartilhamento. Isso acontece porque a página `MarketDetailPage` está fechando o modal prematuramente ao chamar `setSelectedOutcome(null)` logo após a compra.

## Fluxo Atual (Incorreto)
```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Usuário clica   │     │  TradingModal    │     │ MarketDetailPage│
│ "Comprar"       │────►│  handleConfirm() │────►│ handleConfirm() │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ setSelectedOutcome(null)
                                                 │ (fecha o modal) │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Toast de sucesso│
                                                 │ (sem compartilhamento)
                                                 └─────────────────┘
```

## Fluxo Corrigido
```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Usuário clica   │     │  TradingModal    │     │ MarketDetailPage│
│ "Comprar"       │────►│  handleConfirm() │────►│ handleConfirm() │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                         │
                                ▼                         ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ setSuccessData() │     │ (não fecha modal│
                        └──────────────────┘     │  prematuramente)│
                                │                └─────────────────┘
                                ▼
                        ┌──────────────────┐
                        │ PurchaseSuccess  │
                        │ Modal com        │
                        │ compartilhamento │
                        └──────────────────┘
                                │
                                ▼ (usuário clica fechar)
                        ┌──────────────────┐
                        │ onClose()        │
                        └──────────────────┘
```

## Alterações Necessárias

### 1. Arquivo: `src/pages/MarketDetailPage.tsx`

**Modificação 1 - Função `handleConfirmPurchase` (linhas 154-183)**
- Remover a chamada `setSelectedOutcome(null)` da função de sucesso
- Manter a atualização de dados (balanço, contratos, evento) em segundo plano
- Deixar o `TradingModal` controlar quando fechar

**Modificação 2 - Função `handleConfirmSell` (linhas 185-208)**  
- Aplicar a mesma correção para vendas

**Modificação 3 - Callback do `MultiOptionPurchaseModal` (linhas 725-747)**
- Não fechar o modal após confirmar a compra
- Deixar o modal exibir a tela de sucesso

---

## Detalhes Técnicos

A correção envolve remover as linhas que fecham os modais prematuramente:

**Em `handleConfirmPurchase`:**
```typescript
// REMOVER esta linha (169):
setSelectedOutcome(null);
```

**Em `handleConfirmSell`:**
```typescript
// REMOVER esta linha (195):
setSelectedOutcome(null);
```

O `TradingModal` já tem a lógica correta para:
1. Chamar `setSuccessData()` após compra bem-sucedida
2. Renderizar `PurchaseSuccessModal` quando `successData` existe
3. Chamar `onClose()` apenas quando o usuário fecha a tela de sucesso

---

## Resultado Esperado

Após a compra:
1. Toast de sucesso continua aparecendo
2. Modal exibe automaticamente a tela de compartilhamento com:
   - Confetti de celebração
   - Card visual da posição comprada
   - Botões de compartilhamento (Download, Copiar, X, WhatsApp, Instagram)
   - Dados da compra (contratos, valor investido, lucro potencial)
3. Usuário pode compartilhar ou fechar quando quiser
