

# Plano: Correção de Caracteres Estranhos no PDF

## Problema Identificado
O jsPDF não suporta emojis Unicode nativamente. Os caracteres como 🇧🇷, ⚙️, 🌎, 💡, ✓ estão sendo renderizados como texto corrompido "Ø<ÝçØ<Ý÷" no PDF.

## Solução
Substituir todos os emojis por texto simples ou símbolos ASCII compatíveis.

---

## Alterações no Arquivo

**Arquivo:** `src/lib/generatePartnershipPDF.ts`

### Substituições de Emojis

| Linha | Antes | Depois |
|-------|-------|--------|
| 158 | `'🇧🇷 CASE DE SUCESSO BRASILEIRO'` | `'[BRASIL] CASE DE SUCESSO BRASILEIRO'` |
| 239 | `'⚙️ PLATAFORMA 100% PERSONALIZÁVEL'` | `'PLATAFORMA 100% PERSONALIZAVEL'` |
| 302 | `'✓ Tipos, categorias...'` | `'> Tipos, categorias...'` |
| 312 | `'🌎 EVENTOS BRASILEIROS E GLOBAIS'` | `'EVENTOS BRASILEIROS E GLOBAIS'` |
| 368 | `'⚙️ Todos os módulos...'` | `'Todos os modulos...'` |
| 407 | `'💡 Modelo comprovado...'` | `'Modelo comprovado...'` |
| 498+ | `'✓ Primeiro mover...'` | `'> Primeiro mover...'` |

### Lista Completa de Substituições

```text
🇧🇷 → [BRASIL]
⚙️  → (remover ou usar ">>")
🌎  → (remover)
💡  → (remover ou usar "*")
✓   → ">"
```

---

## Detalhes Técnicos

### Por que isso acontece?
O jsPDF usa fontes padrão (Helvetica, Times, Courier) que não incluem glifos para emojis. Quando tenta renderizar, produz caracteres corrompidos.

### Alternativas (não recomendadas para este caso)
1. Embutir fonte customizada com suporte a emojis (complexo)
2. Usar html2canvas para renderizar como imagem (perde qualidade de texto)

### Solução escolhida
Substituir emojis por texto ASCII simples - é a solução mais limpa e mantém a qualidade do PDF.

---

## Resultado Esperado
PDF profissional sem caracteres estranhos, mantendo a legibilidade e profissionalismo da apresentação.

