
## Historico Real de Volume para Comparativos Precisos

### Problema Atual
O hook `useAdminDashboardMetrics.ts` usa uma aproximacao imprecisa para calcular a variacao de volume:
```typescript
const totalVolumePrev = totalVolume * 0.95; // Approximate previous volume
```

Isso sempre mostra +5.26% de crescimento, independente da realidade.

### Solucao Proposta
Criar uma tabela de snapshots diarios que armazena o volume total da plataforma a cada dia, permitindo comparacoes precisas entre periodos.

---

### Arquitetura

```text
+------------------+     +------------------------+     +----------------------+
|  markets table   | --> |  daily_volume_snapshots | <-- |  useAdminDashboard   |
|  (total_volume)  |     |  (historico diario)     |     |  Metrics.ts          |
+------------------+     +------------------------+     +----------------------+
        |                         ^
        |                         |
        v                         |
+------------------+     +------------------------+
|  transactions    |     |  snapshot-daily-volume |
|  (source of      |     |  Edge Function (cron)  |
|   truth)         |     +------------------------+
+------------------+
```

---

### Fase 1: Tabela de Snapshots

**Migracao SQL:**
```sql
CREATE TABLE public.daily_volume_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_platform_volume NUMERIC NOT NULL DEFAULT 0,
  total_trades_count INTEGER NOT NULL DEFAULT 0,
  active_markets_count INTEGER NOT NULL DEFAULT 0,
  daily_volume NUMERIC NOT NULL DEFAULT 0,
  daily_trades_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscas por data
CREATE INDEX idx_daily_volume_snapshots_date 
ON daily_volume_snapshots(snapshot_date DESC);

-- RLS apenas para admins lerem
ALTER TABLE public.daily_volume_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read snapshots"
ON public.daily_volume_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND u.raw_user_meta_data->>'role' = 'admin'
  )
);
```

**Dados a armazenar por dia:**
| Campo | Descricao |
|-------|-----------|
| `snapshot_date` | Data do snapshot (UNIQUE) |
| `total_platform_volume` | Volume acumulado total da plataforma |
| `total_trades_count` | Total de trades desde o inicio |
| `active_markets_count` | Mercados OPEN naquele dia |
| `daily_volume` | Volume apenas daquele dia |
| `daily_trades_count` | Trades apenas daquele dia |

---

### Fase 2: Edge Function para Captura Diaria

**Arquivo:** `supabase/functions/snapshot-daily-volume/index.ts`

```typescript
// Executada diariamente via cron (23:59 UTC-3)
// Calcula e salva metricas do dia

async function handler(req: Request) {
  // 1. Buscar volume total de markets.total_volume
  // 2. Contar trades do dia em transactions
  // 3. Contar mercados ativos
  // 4. Inserir/Upsert na tabela daily_volume_snapshots
}
```

**Logica:**
1. Soma `total_volume` de todos os mercados
2. Conta trades do dia (transactions com created_at de hoje)
3. Conta mercados com status = 'OPEN'
4. Faz UPSERT na tabela (para permitir reexecucao)

---

### Fase 3: Configuracao do Cron Job

**Habilitar extensoes necessarias:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

**Agendar execucao diaria:**
```sql
SELECT cron.schedule(
  'daily-volume-snapshot',
  '59 23 * * *',  -- 23:59 todos os dias
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT_REF].supabase.co/functions/v1/snapshot-daily-volume',
    headers := '{"Authorization": "Bearer [ANON_KEY]"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

### Fase 4: Atualizar Hook de Metricas

**Arquivo:** `src/hooks/useAdminDashboardMetrics.ts`

Modificar para buscar dados reais dos snapshots:

```typescript
// Buscar snapshot de ontem
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const { data: yesterdaySnapshot } = await supabase
  .from('daily_volume_snapshots')
  .select('*')
  .eq('snapshot_date', yesterday.toISOString().split('T')[0])
  .single();

// Buscar snapshot de 7 dias atras
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const { data: weekAgoSnapshot } = await supabase
  .from('daily_volume_snapshots')
  .select('*')
  .eq('snapshot_date', sevenDaysAgo.toISOString().split('T')[0])
  .single();

// Calcular variacao real
const totalVolumePrev = yesterdaySnapshot?.total_platform_volume ?? totalVolume;
const totalVolumeChange = calcChange(totalVolume, totalVolumePrev);
```

**Metricas comparativas disponiveis:**
- Volume Total: hoje vs ontem
- Volume Semanal: ultimos 7d vs 7d anteriores
- Trades Diarios: hoje vs ontem
- Trades Semanais: ultimos 7d vs 7d anteriores

---

### Fase 5: Backfill de Dados Historicos

Para preencher dados historicos (antes do cron), criar uma funcao de backfill:

**Arquivo:** `supabase/functions/backfill-volume-snapshots/index.ts`

```typescript
// Percorre transactions agrupadas por dia
// Calcula volume acumulado ate cada dia
// Insere snapshots retroativos
```

**Query de backfill:**
```sql
WITH daily_data AS (
  SELECT 
    DATE(created_at) as snapshot_date,
    SUM(total_amount) as daily_volume,
    COUNT(*) as daily_trades_count
  FROM transactions
  GROUP BY DATE(created_at)
)
INSERT INTO daily_volume_snapshots (
  snapshot_date, daily_volume, daily_trades_count, total_platform_volume
)
SELECT 
  snapshot_date,
  daily_volume,
  daily_trades_count,
  SUM(daily_volume) OVER (ORDER BY snapshot_date) as total_platform_volume
FROM daily_data
ON CONFLICT (snapshot_date) DO NOTHING;
```

---

### Arquivos a Criar/Modificar

| Acao | Arquivo |
|------|---------|
| **SQL** | Criar tabela `daily_volume_snapshots` |
| **Criar** | `supabase/functions/snapshot-daily-volume/index.ts` |
| **Criar** | `supabase/functions/backfill-volume-snapshots/index.ts` |
| **Modificar** | `src/hooks/useAdminDashboardMetrics.ts` |
| **Modificar** | `src/integrations/supabase/types.ts` (auto-update) |

---

### Detalhes Tecnicos

**Tipo TypeScript para a tabela:**
```typescript
interface DailyVolumeSnapshot {
  id: string;
  snapshot_date: string;       // 'YYYY-MM-DD'
  total_platform_volume: number;
  total_trades_count: number;
  active_markets_count: number;
  daily_volume: number;
  daily_trades_count: number;
  created_at: string;
}
```

**Fallback quando nao houver snapshot:**
- Se nao existir snapshot de ontem, usar volume atual (variacao = 0%)
- Mostrar indicador visual de "dados insuficientes"

**Observacoes sobre pg_cron:**
- A extensao `pg_cron` precisa ser habilitada manualmente no Supabase Dashboard
- Alternativa: usar servico externo (GitHub Actions, Vercel Cron) para chamar a Edge Function

---

### Ordem de Implementacao

1. Criar tabela `daily_volume_snapshots` com migracao SQL
2. Criar Edge Function `snapshot-daily-volume`
3. Executar backfill para dados historicos
4. Atualizar `useAdminDashboardMetrics.ts` para usar snapshots
5. Configurar cron job (pg_cron ou externo)
6. Testar comparativos no dashboard
