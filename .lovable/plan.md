

# Remover Bloco de Explicação do Contrato NÃO

## Problema
O bloco de explicação do contrato NÃO (caixa vermelha) ainda está visível no modal de compra, mesmo após a remoção do título "Kalshi-style".

## Solução
Remover completamente o bloco de explicação (linhas 344-357) do arquivo `MultiOptionPurchaseModal.tsx`.

## Mudança

**Arquivo:** `src/components/market/MultiOptionPurchaseModal.tsx`

**Remover este bloco (linhas 344-357):**
```tsx
{/* Explanation for NO contracts */}
{side === 'NO' && (
  <div className="space-y-2 p-3 rounded-lg bg-no/10 border border-no/20">
    <p className="text-xs text-muted-foreground">
      Você ganha R$1 por contrato se <span className="font-medium">{selectedOption.label}</span> <strong>NÃO</strong> vencer.
      {otherOptions.length > 0 && (
        <span> Ou seja, se qualquer outra opção vencer ({otherOptions.slice(0, 3).map(o => o.label).join(', ')}{otherOptions.length > 3 ? '...' : ''}).</span>
      )}
    </p>
    <p className="text-xs text-no">
      ⚠️ Se {selectedOption.label} vencer, você perde 100% do investimento.
    </p>
  </div>
)}
```

## Resultado
O modal de compra NÃO ficará mais limpo, sem a caixa de explicação vermelha.

