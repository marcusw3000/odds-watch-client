
# Correção: Layout Vermelho para Compras NÃO

## Problema Identificado

Ao comprar "NÃO" em um mercado de múltiplas opções, o modal de sucesso (`PurchaseSuccessModal`) exibe layout verde em vez de vermelho. Isso ocorre por dois motivos:

1. **`MultiOptionPurchaseModal.tsx` linha 273**: O `outcome` está hardcoded como `"YES"`
2. **`PurchaseSuccessModal.tsx` linha 217-220**: Para multi-option, usa cor primária genérica em vez de respeitar YES/NO

---

## Solução

### Arquivo 1: `src/components/market/MultiOptionPurchaseModal.tsx`

**Antes (linha 273):**
```typescript
outcome="YES"
```

**Depois:**
```typescript
outcome={side}
```

Isso passa o valor correto (`"YES"` ou `"NO"`) para o modal de sucesso.

---

### Arquivo 2: `src/components/market/PurchaseSuccessModal.tsx`

**Antes (linhas 217-220):**
```tsx
{isMultiOption ? (
  <span className="px-4 py-2 rounded-lg font-bold text-lg bg-primary/20 text-primary border border-primary/30">
    {optionLabel}
  </span>
) : (
```

**Depois:**
```tsx
{isMultiOption ? (
  <span className={cn(
    "px-4 py-2 rounded-lg font-bold text-lg",
    isYes
      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
  )}>
    {isYes ? '' : 'NÃO '}{optionLabel}
  </span>
) : (
```

Isso garante que:
- Compra **SIM** na opção X → Badge verde com "Competidor Beta"
- Compra **NÃO** na opção X → Badge vermelho com "NÃO Competidor Beta"

---

## Resultado Visual

| Ação | Cor do Badge | Texto |
|------|--------------|-------|
| Comprar SIM em "Competidor Beta" | Verde | "Competidor Beta" |
| Comprar NÃO em "Competidor Beta" | Vermelho | "NÃO Competidor Beta" |

---

## Arquivos Afetados

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/components/market/MultiOptionPurchaseModal.tsx` | Corrigir prop `outcome` (1 linha) |
| `src/components/market/PurchaseSuccessModal.tsx` | Aplicar cor condicional para multi-option (5 linhas) |

**Tempo estimado: ~10 minutos**
