
# Plano: Garantir Centralização do Modal de Compra no Desktop

## Problema Atual

Analisando a imagem enviada, o modal de compra aparece deslocado verticalmente, não centralizado perfeitamente no meio da tela. Mesmo após a correção anterior que adicionou `flex items-center justify-center`, o modal ainda não fica centralizado.

## Causa Técnica

O código atual usa:
```typescript
<div className="fixed inset-0 z-50 overflow-y-auto">
  <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
```

O problema é que `overflow-y-auto` no container externo pode interferir com o comportamento de centralização. Além disso, o modal pode estar sendo renderizado dentro de um contexto de scroll que afeta seu posicionamento.

## Solução

Simplificar a estrutura removendo o `overflow-y-auto` do container pai e garantindo que o container de centralização use altura mínima e alinhamento correto:

```typescript
// Desktop: fixed modal - properly centered
return (
  <div className="fixed inset-0 z-50">
    {/* Backdrop */}
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    />
    {/* Centering container - usando min-h-full para garantir centralização */}
    <div className="fixed inset-0 flex items-center justify-center p-4">
      {/* Modal */}
      <div 
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto"
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

**Linhas afetadas:** 509-528

**Mudanças:**
1. Remover `overflow-y-auto` do container externo (linha 511)
2. Remover `pointer-events-none` do container de centralização (linha 518)
3. Adicionar `max-h-[90vh] overflow-y-auto` no modal interno para scroll quando necessário
4. Remover `pointer-events-auto` do modal (não é mais necessário)

---

## Resultado Esperado

- Modal sempre centralizado verticalmente e horizontalmente
- Scroll interno apenas quando o conteúdo do modal exceder 90% da viewport
- Clique no backdrop (fora do modal) continua fechando
- Compatível com qualquer posição de scroll da página
