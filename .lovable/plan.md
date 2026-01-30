
# Plano: Corrigir Posicionamento do Modal de Compra no Desktop

## Problema Identificado

O modal de trading no desktop (`MinimalTradingCard`) não está sendo centralizado corretamente na viewport. Dependendo da posição de scroll do navegador, o card aparece muito acima ou muito abaixo, dificultando a visualização.

### Causa Técnica

O código atual (linhas 510-522):
```typescript
return (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    />
    <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in-0 zoom-in-95">
      {modalContent}
    </div>
  </div>
);
```

**Problemas:**
1. O backdrop usa `fixed inset-0` dentro de outro `fixed inset-0`, causando conflito de stacking
2. O modal content usa apenas `relative`, fazendo com que ele não fique posicionado corretamente em relação ao viewport quando há scroll

---

## Solução

Reestruturar o modal desktop para garantir centralização correta:

1. Manter backdrop como primeiro filho com `fixed inset-0`
2. O container do modal deve ter `z-index` maior que o backdrop
3. Adicionar `overflow-y-auto` para casos onde o modal é maior que a tela

### Código Corrigido

```typescript
// Desktop: fixed modal - properly centered
return (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    {/* Backdrop */}
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    />
    {/* Centering container */}
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
    >
      {/* Modal */}
      <div 
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in-0 zoom-in-95 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {modalContent}
      </div>
    </div>
  </div>
);
```

---

## Alterações

### Arquivo: `src/components/market/MinimalTradingCard.tsx`

**Linhas afetadas:** 509-523

**Mudanças:**
1. Separar backdrop e container de centralização
2. Container de centralização com `fixed inset-0 flex items-center justify-center`
3. Usar `pointer-events-none` no container e `pointer-events-auto` no modal
4. Manter animação de entrada e estilo visual

---

## Resultado Esperado

- Modal sempre centralizado na viewport, independente da posição de scroll
- Clique fora do modal fecha corretamente
- Backdrop cobre toda a tela
- Animação de entrada preservada
