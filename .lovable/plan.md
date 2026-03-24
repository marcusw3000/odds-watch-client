

# Aumentar tempo de retencao do chat para 6 horas

## Situacao atual

O chat limpa mensagens com mais de 1 hora (`HOUR_MS = 60 * 60 * 1000`). O array local e limitado a 200 mensagens. A verificacao roda a cada 60 segundos.

## Impacto de performance

O custo e minimo: o array guarda no maximo 200 mensagens (limite ja existente no `slice(-200)`). Mesmo com 6 horas de retencao, o limite de 200 mensagens garante que a memoria nunca cresce alem disso. A limpeza a cada 60 segundos filtra um array de no maximo 200 itens -- insignificante.

## Alteracao

**Arquivo**: `src/hooks/useGlobalChat.ts`

Trocar `HOUR_MS` de 1 hora para 6 horas:

```typescript
const RETENTION_MS = 6 * 60 * 60 * 1000; // 6 horas
```

Atualizar a referencia no cleanup interval para usar `RETENTION_MS` em vez de `HOUR_MS`.

Uma unica linha de constante muda. Zero impacto em performance porque o array ja esta limitado a 200 mensagens independentemente do tempo.

