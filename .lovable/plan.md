

# Correção do Slide 14 - Sobreposição do Roadmap

## Problema

A variável `y` não é atualizada após o loop do roadmap. Após renderizar 5 itens (cada um com 12mm de espaçamento), o `y` ainda vale 55. O `y += 10` resulta em `y = 65`, fazendo o highlight box sobrepor os itens Q2-Q3 e esconder o item "2027".

## Correção

### Arquivo: `src/lib/generatePartnershipPDF.ts` (linhas 492-493)

Calcular o `y` correto após o loop antes de posicionar o highlight box:

```typescript
// Antes (errado):
y += 10;

// Depois (correto):
y += roadmapItems.length * 12 + 10;
```

Isso posiciona o highlight box em `y = 55 + 5*12 + 10 = 125`, abaixo de todos os itens do roadmap.

