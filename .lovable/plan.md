

# Excluir a Página /parceria

## O que será feito

Remover completamente a página de apresentação para parceiros e todos os arquivos relacionados.

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `src/pages/PartnershipPresentationPage.tsx` | Deletar |
| `src/lib/generatePartnershipPDF.ts` | Deletar |
| `src/App.tsx` | Remover import e rota `/parceria` |

## Detalhes

- Remover o lazy import do `PartnershipPresentationPage` (~linha 39)
- Remover a `<Route path="/parceria" ...>` (~linha 159)
- Deletar os dois arquivos de código da feature

