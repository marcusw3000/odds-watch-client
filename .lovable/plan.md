
# Plano: Implementar Tela de Pós-Compra para Cards Iniciais

## Problema Identificado

Quando o usuário faz uma compra a partir dos cards na página de mercados, a tela de sucesso (`PurchaseSuccessModal`) **nunca é exibida**. Isso ocorre porque:

1. O usuário clica em "Comprar Sim/Não" no card
2. O `MinimalTradingCard` é aberto como modal
3. Após confirmar a compra, `handleConfirmPurchase` no `MarketsPage.tsx` chama `handleCloseModal()` imediatamente
4. O modal é fechado antes de `setSuccessData()` ser executado
5. A tela de sucesso com confetes e opções de compartilhamento nunca aparece

## Solução

Remover a chamada `handleCloseModal()` após o sucesso da compra em `MarketsPage.tsx`. O `MinimalTradingCard` já gerencia a exibição do `PurchaseSuccessModal` internamente, e o fechamento do modal deve acontecer apenas quando o usuário clicar em "Fechar" na tela de sucesso.

---

## Alteração Necessária

### Arquivo: `src/pages/MarketsPage.tsx`

**Antes (linhas 174-203):**
```typescript
const handleConfirmPurchase = async (shares: number, maxCost: number) => {
  if (!selectedEvent) return;

  const result = await MarketDataProvider.purchaseContract(/*...*/);

  if (result.success) {
    setUserBalance(prev => prev - actualCost);
    toast({ title: 'Compra realizada!', /*...*/ });
    handleCloseModal();  // ← PROBLEMA: fecha antes do modal de sucesso
    // ...
  } else {
    throw new Error(result.message);
  }
};
```

**Depois:**
```typescript
const handleConfirmPurchase = async (shares: number, maxCost: number) => {
  if (!selectedEvent) return;

  const result = await MarketDataProvider.purchaseContract(/*...*/);

  if (result.success) {
    setUserBalance(prev => prev - actualCost);
    // Remover toast - a tela de sucesso já celebra a compra
    // Remover handleCloseModal() - o MinimalTradingCard mostrará o PurchaseSuccessModal
    window.dispatchEvent(new Event('market-update'));
    triggerPortfolioRefresh();
    const portfolio = await MarketDataProvider.getUserPortfolio();
    setUserContracts(portfolio.contracts || []);
  } else {
    throw new Error(result.message);
  }
};
```

### Mesma alteração para vendas (`handleConfirmSell`)

Remover `handleCloseModal()` também da função de venda para manter consistência.

---

## Fluxo Corrigido

```text
1. Usuário clica "Comprar Sim" no card
      ↓
2. MinimalTradingCard abre (drawer no mobile, modal no desktop)
      ↓
3. Usuário confirma a compra
      ↓
4. handleConfirmPurchase executa (atualiza saldo, portfolio)
      ↓
5. MinimalTradingCard define successData
      ↓
6. PurchaseSuccessModal é exibido com confetes
      ↓
7. Usuário compartilha ou clica "Fechar"
      ↓
8. onClose() é chamado → modal fecha
```

---

## Resultado Esperado

Após a implementação:
- Confetes aparecem após compra bem-sucedida
- Card de compartilhamento com detalhes da posição é exibido
- Botões de compartilhamento (Download, Copiar, X, WhatsApp, Instagram) funcionam
- Modal só fecha quando usuário clicar em "Fechar"
