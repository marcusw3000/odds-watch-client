
# Plano: Adicionar Tela de Resumo de Operação para Compra NÃO

## Problema Identificado
Atualmente, a compra de **NÃO** em mercados múltiplos:
1. Executa corretamente a operação via `execute-multi-trade-batch`
2. Mostra apenas um toast simples ("Compra NÃO realizada!")
3. **NÃO exibe** o modal de sucesso (`PurchaseSuccessModal`) com resumo detalhado

Já a compra de **SIM**:
1. Mostra o modal de sucesso com confetti
2. Exibe contratos, valor investido, lucro potencial
3. Permite compartilhar a posição

## Causa Raiz
No `MarketDetailPage.tsx` (linhas 725-750), após a chamada bem-sucedida da compra NÃO, o código faz `return` imediatamente após o toast, impedindo que os dados retornem ao `MultiOptionPurchaseModal` para configurar o `successData`.

## Solução Proposta

### 1. Modificar o fluxo de confirmação no `MarketDetailPage.tsx`
Em vez de fazer `return` após o toast, **retornar os dados da API** para que o modal possa processá-los e exibir a tela de sucesso.

```text
// Atual (linha 750):
return;  // Impede o fluxo de sucesso

// Proposto:
// Não faz return - deixa os dados voltarem ao modal
```

### 2. Ajustar `MultiOptionPurchaseModal.tsx` para receber dados de sucesso da API

**Modificar a interface `onConfirm`** para que a função possa retornar dados de sucesso do batch:

```text
// Modificar o tipo de retorno de onConfirm para:
onConfirm: (...) => Promise<BatchTradeResult | void>

// Onde BatchTradeResult contém:
{
  contracts: Array<{ option_id, option_label, shares, cost }>,
  totalCost: number,
  newBalance: number
}
```

### 3. Atualizar a lógica de sucesso para NÃO

No callback do `onConfirm` dentro do modal (para `side === 'NO'`):

```text
const result = await onConfirm(selectedOption.id, 0, totalCost, 'NO', slippage);

// Exibir dados reais da API:
setSuccessData({
  shares: result.contracts.length,  // Número de opções compradas
  totalCost: result.totalCost,      // Custo real debitado
  potentialProfit: calculatePotentialProfit(result.contracts),
});
```

### 4. Criar componente `MultiOptionSuccessModal` (opcional, mas recomendado)

Para compras NÃO, o resumo deve mostrar informações diferentes:
- **Opções compradas**: Lista das opções onde contratos foram criados
- **Total investido**: Valor real debitado
- **Contratos por opção**: Detalhamento de cada compra

```text
┌─────────────────────────────────────────┐
│        Compra NÃO Confirmada! 🎉         │
├─────────────────────────────────────────┤
│  Você apostou CONTRA: "Opção X"         │
│                                         │
│  Contratos comprados:                   │
│  ✓ Opção A: 12 contratos (R$8.40)       │
│  ✓ Opção B: 8 contratos  (R$6.20)       │
│  ✓ Opção C: 15 contratos (R$5.40)       │
│                                         │
│  ─────────────────────────────────────  │
│  Total investido:        R$20.00        │
│  Lucro potencial:        +R$15.00       │
└─────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `MarketDetailPage.tsx` | Retornar dados da API em vez de `return` após sucesso |
| `MultiOptionPurchaseModal.tsx` | Receber dados retornados e configurar `successData` com valores reais |
| `PurchaseSuccessModal.tsx` | Adicionar suporte para lista de contratos (prop `contracts`) |

## Detalhes Técnicos

### Mudança no `MarketDetailPage.tsx`

```typescript
// Linha ~725-750: Em vez de return, retornar os dados
if (side === 'NO') {
  const { data, error } = await supabase.functions.invoke(...);
  // ... validações ...
  
  setUserBalance(data.newBalance);
  triggerPortfolioRefresh();
  handleRefreshPrice();
  
  // NOVO: Retornar dados para o modal processar
  return {
    contracts: data.contracts,
    totalCost: data.totalCost,
    excludedOptionLabel: selectedOption.label
  };
}
```

### Mudança no `MultiOptionPurchaseModal.tsx`

```typescript
// Linha ~306-316
onConfirm={async (totalCost, slippage) => {
  setIsConfirming(true);
  try {
    const result = await onConfirm(selectedOption.id, 0, totalCost, 'NO', slippage);
    
    // Calcular lucro potencial: cada contrato vale R$1 se vencer
    const totalShares = result?.contracts?.reduce((sum, c) => sum + c.shares, 0) || 0;
    
    setSuccessData({
      shares: totalShares,
      totalCost: result?.totalCost || totalCost,
      potentialProfit: totalShares - (result?.totalCost || totalCost),
      contracts: result?.contracts, // NOVO: para exibir detalhes
      excludedOptionLabel: selectedOption.label, // NOVO
    });
  } catch (err) { ... }
}}
```

### Atualização do `PurchaseSuccessModal.tsx`

Adicionar props opcionais para exibir detalhes do batch:

```typescript
interface PurchaseSuccessModalProps {
  // ... props existentes ...
  contracts?: Array<{ option_label: string; shares: number; cost: number }>;
  excludedOptionLabel?: string; // Opção que o usuário apostou CONTRA
}
```

E renderizar condicionalmente quando `contracts` estiver presente:

```typescript
{isNoBatch && contracts && (
  <div className="space-y-2">
    <p className="text-sm text-muted-foreground">Contratos comprados:</p>
    {contracts.map(c => (
      <div key={c.option_label} className="flex justify-between text-sm">
        <span>{c.option_label}</span>
        <span>{c.shares} contratos (R${c.cost.toFixed(2)})</span>
      </div>
    ))}
  </div>
)}
```

## Resumo das Entregas

1. **`MarketDetailPage.tsx`**: Ajustar `onConfirm` para retornar dados da API de batch
2. **`MultiOptionPurchaseModal.tsx`**: Processar retorno e popular `successData` com valores reais
3. **`PurchaseSuccessModal.tsx`**: Suportar exibição de lista de contratos para compras NÃO

## Resultado Esperado

Após a compra de NÃO:
- Modal de sucesso aparece com confetti
- Mostra a opção excluída ("Você apostou CONTRA: Opção X")
- Lista os contratos comprados nas outras opções
- Exibe total investido real e lucro potencial calculado
- Permite compartilhar a posição nas redes sociais
