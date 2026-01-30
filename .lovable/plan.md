
## Objetivo
Garantir que **sempre que abrir a compra/venda de um card**, o modal (`MinimalTradingCard`) fique **centralizado no meio da tela**, independente da posição do scroll.

---

## Diagnóstico (por que ainda não centraliza)
O CSS `position: fixed` normalmente fixa o elemento na viewport, porém no projeto existe `contain: 'layout'` em containers ancestrais (ex.: `src/components/layout/Layout.tsx` e também em `src/pages/MarketsPage.tsx`).

Quando um ancestral usa CSS Containment (`contain`), ele pode virar um “containing block” para descendentes, fazendo com que elementos `fixed`:
- deixem de referenciar a viewport, e passem a referenciar o container
- aparentem “subir/descer” conforme a posição/scroll e layout do container

Isso explica o comportamento “depende da posição do navegador / scroll”.

---

## Solução proposta (robusta)
Renderizar o modal desktop via **Portal para `document.body`**, garantindo que o overlay fique fora de qualquer container com `contain` (ou outros efeitos como `transform`), e então o `fixed inset-0` volta a ser **100% relativo à viewport**.

Vantagens:
- resolve o problema na raiz sem precisar remover `contain` (que pode estar ali por performance)
- garante centralização consistente
- reduz chance de regressão em outras telas que também usem `contain`

---

## Mudanças planejadas

### 1) `src/components/market/MinimalTradingCard.tsx`
**Ajuste do retorno do Desktop**:
- Importar `createPortal` de `react-dom`
- Em vez de `return (...)` direto no Desktop, fazer:
  - `return createPortal((...overlay...), document.body)`
- Manter a estrutura atual de centralização:
  - backdrop `fixed inset-0`
  - container `fixed inset-0 flex items-center justify-center p-4`
  - modal com `max-h-[90vh] overflow-y-auto`

**Detalhes de robustez**:
- Adicionar um guard para ambientes onde `document` não exista (muito raro aqui, mas é uma boa prática):
  - se `typeof document === 'undefined'`, retornar o JSX normal (fallback)
- Garantir que o `z-50` continue acima de elementos do layout (Header/BottomNav), e se necessário subir para `z-[100]` ou `z-[999]` (somente se houver conflito visual).

---

## Verificação / Testes
1) Na rota `/markets`, rolar a página para:
   - topo
   - meio
   - bem perto do rodapé
2) Abrir a compra em vários cards em cada posição.
3) Confirmar que o modal:
   - abre sempre no centro da viewport (vertical e horizontal)
   - backdrop cobre a tela inteira
   - clique fora fecha corretamente
   - scroll acontece dentro do modal quando necessário (conteúdo alto)
4) Repetir no mobile para garantir que o Drawer continua funcionando como antes.

---

## Observação (opcional, não obrigatório)
Se existirem outros overlays customizados com `fixed` que também “escapem” do centro, a mesma estratégia (Portal) deve ser aplicada neles, porque a causa é estrutural (`contain: layout` em containers).

---

## Resultado esperado
- Modal de compra/venda sempre centralizado no meio da tela no desktop, independente do scroll.
- Experiência consistente e previsível ao abrir qualquer card.
