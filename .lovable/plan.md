

# Adicionar Timer Visivel em Todos os Cards

## Problema Atual

Os cards ja usam `MarketStatusBadge` na Zone 2, que tem logica de countdown interna, mas:
1. Os cards passam `timeToEvent` mas **nao passam `timeToHalt`**, entao o countdown para mercados OPEN nunca aparece
2. O countdown e sutil (texto pequeno anexado ao label do badge)
3. O usuario quer um timer dedicado e visivel em todos os estilos de card

## Solucao

Criar um componente `CardCountdown` compacto e adiciona-lo na Zone 2 (status row) de todos os 4 card styles, ao lado do `MarketStatusBadge`.

### Comportamento do timer por status:
- **OPEN**: mostra tempo ate halt (ex: "⏱ 02:34:15") em cor verde
- **HALTED**: mostra tempo ate evento (ex: "⏱ 00:45:30") em cor amarela  
- **CONTESTED**: mostra tempo restante de contestacao em cor amarela
- **PENDING**: mostra "Aguardando" sem countdown
- **SETTLED**: nao mostra timer

### Layout

A Zone 2 atual tem 32px de altura com `flex items-center gap-2`. O timer sera um badge compacto com icone de relogio + countdown formatado, ocupando o espaco restante apos o status badge. Para caber, o grid row de status aumenta de `32px` para `auto` (com min-height).

```text
Zone 2 (status row):
[StatusBadge] [RecurrenceLabel?] -----> [⏱ 02:34:15]
```

## Arquivos Modificados

### 1. Novo: `src/components/market/cards/CardCountdown.tsx`
- Componente que recebe `statusInfo` do `useMarketStatus`
- Usa `formatCountdown()` para formatar o tempo
- Icone `Timer` do lucide + texto mono
- Cores contextuais (verde para OPEN, amarelo para HALTED/CONTESTED)
- Pisca (`animate-pulse`) quando urgente (< 5 min)

### 2. `src/components/market/cards/CardGridLayout.tsx`
- Alterar grid de `grid-rows-[auto_32px_48px_48px_40px]` para `grid-rows-[auto_auto_48px_48px_40px]` para que a Zone 2 acomode o timer sem cortar

### 3. Todos os 4 card styles (Default, Buttons, Simple, Minimal)
- Importar `CardCountdown`
- Adicionar na Zone 2, posicionado a direita com `ml-auto`
- Passar `statusInfo` que ja existe em cada card

