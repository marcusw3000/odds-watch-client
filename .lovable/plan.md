

# Remover Botão de Aprovação Rápida

## O que será feito

Remover o botão de aprovação rápida (ícone ✓ verde) da tabela de sugestões. Toda aprovação deve passar pelo modal de revisão do administrador.

## Arquivo: `src/pages/admin/AdminSuggestionsPage.tsx`

Remover o bloco do botão de aprovação rápida (linhas ~253-265):

```tsx
// REMOVER este botão inteiro:
<Button
  variant="ghost"
  size="icon"
  className="text-success hover:text-success"
  onClick={() => {
    setSelectedSuggestion(suggestion);
    setAdminNotes('');
    handleApprove();
  }}
  title="Aprovar"
>
  <Check className="h-4 w-4" />
</Button>
```

O botão de rejeição rápida (ícone X) também será removido pelo mesmo motivo — ambas as ações devem passar pelo modal de revisão. Ficam apenas o botão "Ver detalhes" (olho) e o botão "Criar Mercado" (+).

