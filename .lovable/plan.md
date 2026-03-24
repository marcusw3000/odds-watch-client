

# Melhorar formato do timer na pagina de detalhe do mercado

## Problema

Na pagina de detalhe (`MarketDetailPage.tsx`), os cards de "Halt de Trading" e "Evento" usam `differenceInDays()` e sempre mostram "em X dias", sem granularidade para horas ou minutos. Quando falta menos de 1 dia, mostra apenas "Hoje" — sem countdown.

Ja nos cards da listagem, o `formatCountdown()` mostra `HH:MM:SS` quando falta menos de 24h.

## Solucao

Substituir a logica inline de `differenceInDays` nos dois cards por uma funcao reutilizavel que:
- **> 30 dias**: mostra "em ~X meses" ou "em X dias"
- **1-30 dias**: mostra "em X dias"  
- **< 24h**: mostra countdown `HH:MM:SS` atualizado em tempo real
- **< 1h**: mostra `MM:SS` com destaque de urgencia
- **Passado**: mostra "Encerrado"

Isso reaproveita o `formatCountdown()` ja existente em `useMarketStatus.ts` e o `statusInfo` que ja esta disponivel na pagina.

## Detalhes Tecnicos

### Arquivo: `src/pages/MarketDetailPage.tsx`

**Card "Halt de Trading"** (linhas 335-342):
- Substituir logica de `differenceInDays` por:
  - Se `statusInfo.timeToHalt <= 0`: "Encerrado"
  - Se `statusInfo.timeToHalt < 86400` (24h): usar `formatCountdown(statusInfo.timeToHalt)` com cor de urgencia
  - Senao: manter "em X dias" usando `Math.floor(timeToHalt / 86400)`

**Card "Evento"** (linhas 359-366):
- Mesma logica usando `statusInfo.timeToEvent`

**Beneficio**: os valores `timeToHalt` e `timeToEvent` do `statusInfo` ja sao atualizados a cada segundo pelo hook `useMarketStatus`, entao o countdown sera automaticamente em tempo real sem adicionar nenhum `setInterval` extra.

### Nenhum arquivo novo necessario

Reutiliza `formatCountdown` de `useMarketStatus.ts` e `statusInfo` ja importado na pagina.

