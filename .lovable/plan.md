
## Histórico de Preços Real para Mercados

### Problema Identificado

Atualmente, o sistema exibe "Mercado recente - Histórico sendo coletado..." para mercados com menos de 3 dias, mas **não há coleta real de histórico**. Os dados de preço nos gráficos são gerados com mock determinístico no frontend.

### Situação Atual

| Componente | Comportamento |
|------------|---------------|
| `TrendingMarketCard` | Mock com seeded random baseado em `event.id` |
| `MarketDataProvider.getOddsHistory()` | Mock com `Math.random()` |
| `PriceSparkline` | Mock com seeded random |
| **Tabela de histórico** | ❌ Não existe |

### Dados Disponíveis

A tabela `transactions` já possui `price_per_share` em cada trade, que pode ser usado para derivar o histórico real:

```
market_id: 260e14e8-...
position: YES
price_per_share: 0.9025  ← Preço no momento do trade
created_at: 2026-01-26 01:10:24
```

---

### Solução Proposta: Sistema de Histórico de Preços Real

#### Arquitetura

```text
┌─────────────────────┐     ┌─────────────────────┐
│  execute-trade      │     │  update-admin-event │
│  execute-sell       │────▶│  (ao alterar preços)│
└─────────────────────┘     └─────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────┐
│           market_price_history                  │
│  (market_id, yes_price, no_price, recorded_at)  │
└─────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│  MarketDataProvider.getOddsHistory()            │
│  (busca dados reais + fallback para mock)       │
└─────────────────────────────────────────────────┘
```

---

### Fase 1: Criar Tabela de Histórico de Preços

**Nova tabela:** `market_price_history`

```sql
CREATE TABLE market_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  yes_price NUMERIC(10, 4) NOT NULL,
  no_price NUMERIC(10, 4) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'trade' -- 'trade', 'snapshot', 'initial'
);

-- Índice para queries rápidas
CREATE INDEX idx_market_price_history_market_date 
  ON market_price_history(market_id, recorded_at DESC);

-- RLS policies
ALTER TABLE market_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read price history" 
  ON market_price_history FOR SELECT USING (true);
```

---

### Fase 2: Trigger Automático Após Cada Trade

**Database Trigger** para capturar preço após cada transação:

```sql
CREATE OR REPLACE FUNCTION record_price_after_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas para BUY/SELL (não PAYOUT/DEPOSIT)
  IF NEW.type IN ('BUY', 'SELL') AND NEW.market_id IS NOT NULL THEN
    INSERT INTO market_price_history (market_id, yes_price, no_price, source)
    SELECT 
      NEW.market_id,
      current_yes_price,
      current_no_price,
      'trade'
    FROM markets 
    WHERE id = NEW.market_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_price_after_trade
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION record_price_after_trade();
```

---

### Fase 3: Snapshot Inicial ao Criar Mercado

**Modificar Edge Function:** `create-admin-event`

Adicionar registro do preço inicial (50/50) ao criar um mercado:

```typescript
// Após inserir o mercado
await supabaseAdmin
  .from('market_price_history')
  .insert({
    market_id: newMarket.id,
    yes_price: 0.5,
    no_price: 0.5,
    source: 'initial',
  });
```

---

### Fase 4: Atualizar MarketDataProvider

**Arquivo:** `src/services/MarketDataProvider.ts`

Modificar `getOddsHistory()` para buscar dados reais:

```typescript
async getOddsHistory(eventId: string): Promise<OddsHistoryPoint[]> {
  // Buscar histórico real do banco
  const { data, error } = await supabase
    .from('market_price_history')
    .select('yes_price, no_price, recorded_at')
    .eq('market_id', eventId)
    .order('recorded_at', { ascending: true })
    .limit(200);

  if (error || !data || data.length === 0) {
    // Fallback para mock se não houver dados
    return this.generateMockHistory(eventId);
  }

  // Agrupar por hora para reduzir pontos (smooth chart)
  return this.aggregateByHour(data);
}

private aggregateByHour(data: PriceRecord[]): OddsHistoryPoint[] {
  // Agrupa por hora, pega o último preço de cada hora
  const grouped = new Map<string, PriceRecord>();
  
  data.forEach(record => {
    const hourKey = format(new Date(record.recorded_at), 'yyyy-MM-dd HH:00');
    grouped.set(hourKey, record); // Sobrescreve, mantendo o último
  });

  return Array.from(grouped.values()).map(r => ({
    timestamp: new Date(r.recorded_at),
    yesPrice: Math.round(r.yes_price * 100),
    noPrice: Math.round(r.no_price * 100),
  }));
}
```

---

### Fase 5: Backfill de Dados Históricos

**Edge Function:** `backfill-price-history`

Popula histórico para mercados existentes a partir das transações:

```typescript
// Para cada mercado existente
const { data: transactions } = await supabaseAdmin
  .from('transactions')
  .select('market_id, price_per_share, position, created_at')
  .eq('market_id', marketId)
  .in('type', ['BUY', 'SELL'])
  .order('created_at', { ascending: true });

// Recalcular preços YES/NO a partir dos trades
// Inserir em market_price_history
```

---

### Fase 6: Remover Fallback de "Mercado Recente"

**Arquivo:** `src/components/market/TrendingMarketCard.tsx`

Remover a lógica de 3 dias e sempre exibir o gráfico:

```typescript
// Antes
const isRecentMarket = differenceInDays(new Date(), createdAt) < 3;

// Depois - verificar se tem dados reais
const hasRealHistory = priceHistory.length > 1;

// No JSX
{!hasRealHistory ? (
  <div className="...">
    <Clock className="..." />
    <p>Aguardando primeiro trade...</p>
  </div>
) : (
  <ResponsiveContainer>...</ResponsiveContainer>
)}
```

---

### Arquivos a Modificar/Criar

| Ação | Arquivo |
|------|---------|
| **Criar** | Migração SQL para `market_price_history` + trigger |
| **Modificar** | `supabase/functions/create-admin-event/index.ts` |
| **Modificar** | `src/services/MarketDataProvider.ts` |
| **Modificar** | `src/components/market/TrendingMarketCard.tsx` |
| **Modificar** | `src/components/market/PriceSparkline.tsx` |
| **Criar** | `supabase/functions/backfill-price-history/index.ts` |
| **Atualizar** | `src/integrations/supabase/types.ts` (após migração) |

---

### Benefícios

- Gráficos com dados reais baseados em trades
- Histórico persistido no banco para análises futuras
- Sem delay artificial de 3 dias
- Mercados novos mostram gráfico assim que houver 1 trade
- Backfill permite recuperar histórico de mercados existentes

---

### Detalhes Técnicos

**Estimativa de volume de dados:**
- ~1 registro por trade (atual: ~41 trades total)
- Mercados ativos: ~6
- Crescimento: ~100 registros/dia estimado
- Índice em `(market_id, recorded_at)` garante queries < 10ms

**Agregação de pontos:**
- Raw data: 1 ponto por trade
- Chart display: agregar por hora ou dia dependendo do período
- Sparkline: últimos 7 pontos (1 por dia ou mais recentes)
