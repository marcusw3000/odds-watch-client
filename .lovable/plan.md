

# Plano: Melhorias no PDF de Parceria

## Problemas Identificados

### 1. Acentuação Inconsistente
A correção anterior removeu acentos desnecessariamente - o jsPDF suporta acentos normais UTF-8, o problema era apenas com emojis:

| Linha | Atual | Correção |
|-------|-------|----------|
| 239 | `'PLATAFORMA 100% PERSONALIZAVEL'` | `'PLATAFORMA 100% PERSONALIZÁVEL'` |
| 302 | `'personalizaveis'` | `'personalizáveis'` |
| 368 | `'modulos sao configuraveis'` | `'módulos são configuráveis'` |
| 500 | `'negocio'` | `'negócio'` |
| 501 | `'personalizavel'` | `'personalizável'` |
| 502 | `'expansao'` | `'expansão'` |
| 503 | `'tecnica'` | `'técnica'` |

### 2. Highlight Boxes Muito Finos
Quando não há items (array vazio `[]`), o box fica muito pequeno (altura = 10):
- Linhas 302, 368, 407: boxes com `items: []` ficam achatados

**Solução**: Ajustar altura mínima para 14 quando não há items.

### 3. Melhorias Visuais

#### Rodapé com Linha Decorativa
Adicionar uma linha sutil acima do texto do rodapé para separação visual.

#### Roadmap com Marcadores Visuais (Slide 14)
Adicionar círculos coloridos para cada fase do roadmap, diferenciando a fase atual das futuras.

#### Melhor Distribuição do Slide 12 (Tecnologia)
Aumentar o espaçamento entre as labels e valores para melhor legibilidade.

---

## Alterações Propostas

### Arquivo: `src/lib/generatePartnershipPDF.ts`

#### 1. Corrigir Função `addHighlightBox` (linha 94-113)
```typescript
const addHighlightBox = (title: string, items: string[], y: number) => {
  const boxHeight = items.length > 0 ? (12 + items.length * 6) : 14; // Altura mínima de 14
  // ...resto mantido
};
```

#### 2. Melhorar Função `addFooter` (linha 52-61)
Adicionar linha decorativa antes do texto:
```typescript
const addFooter = () => {
  // Linha decorativa
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  
  doc.setFontSize(7);
  // ...resto mantido
};
```

#### 3. Corrigir Acentuação nas Linhas Afetadas
- Linha 239: `'PLATAFORMA 100% PERSONALIZÁVEL'`
- Linha 302: `'> Tipos, categorias e regras totalmente personalizáveis por parceiro'`
- Linha 368: `'Todos os módulos são configuráveis e podem ser ativados/desativados'`
- Linha 500: `'> Modelo de negócio validado globalmente (Kalshi)'`
- Linha 501: `'> Plataforma 100% personalizável para diferentes parceiros'`
- Linha 502: `'> Arquitetura preparada para expansão internacional'`
- Linha 503: `'> Equipe técnica dedicada e experiente'`

#### 4. Melhorar Roadmap com Marcadores (Slide 14, linhas 472-480)
```typescript
roadmapItems.forEach(([phase, description], i) => {
  // Círculo marcador colorido
  const isCurrentPhase = i === 0;
  doc.setFillColor(...(isCurrentPhase ? COLORS.secondary : COLORS.primary));
  doc.circle(margin - 5, y + i * 12 - 1, 2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isCurrentPhase ? COLORS.secondary : COLORS.primary));
  doc.text(`${phase}:`, margin, y + i * 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  doc.text(description, margin + 30, y + i * 12);
});
```

#### 5. Melhorar Slide de Tecnologia (Slide 12, linhas 427-434)
Aumentar espaçamento da label para melhor alinhamento:
```typescript
doc.text(value, margin + 40, y + i * 10); // Aumentar de 35 para 40
```

---

## Resumo das Melhorias

| Área | Problema | Solução |
|------|----------|---------|
| Acentuação | Removida incorretamente | Restaurar acentos (jsPDF suporta) |
| Highlight boxes | Muito finos quando vazios | Altura mínima de 14 |
| Rodapé | Sem separação visual | Adicionar linha decorativa |
| Roadmap | Lista simples | Marcadores visuais coloridos |
| Tecnologia | Labels muito próximas | Maior espaçamento |

---

## Resultado Esperado
PDF mais polido, profissional e visualmente consistente, com toda a acentuação correta em português brasileiro e elementos visuais melhor distribuídos.

