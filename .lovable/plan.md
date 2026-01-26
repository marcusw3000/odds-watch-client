
## Plano de Melhorias do Painel Administrativo

### Fase 1: Dashboard Aprimorado

#### 1.1 Comparativos com Periodo Anterior
**Arquivo:** `src/hooks/useAdminDashboardMetrics.ts`
- Modificar interface `AdminDashboardMetrics` para incluir campos de comparacao:
  ```typescript
  interface AdminDashboardMetrics {
    totalVolume: number;
    totalVolumePrev: number;      // periodo anterior
    totalVolumeChange: number;    // % variacao
    pendingRevenue: number;
    activeUsers7d: number;
    activeUsers7dPrev: number;
    activeUsers7dChange: number;
    depositsToday: number;
    depositsTodayPrev: number;    // ontem
    depositsTodayChange: number;
    // Novas metricas
    ticketMedio: number;
    taxaConversao: number;        // depositos / visitantes
    tradesHoje: number;
    tradesHojeChange: number;
  }
  ```
- Adicionar queries para buscar dados do periodo anterior (7d-14d, ontem)
- Calcular variacoes percentuais

**Arquivo:** `src/components/admin/MetricCard.tsx` (criar)
- Componente reutilizavel com indicador de variacao
- Seta verde/vermelha + percentual
- Tooltip com valor do periodo anterior

**Arquivo:** `src/pages/admin/AdminDashboard.tsx`
- Substituir cards estaticos pelo novo `MetricCard`
- Adicionar secao "Top 5 Mercados por Volume"
- Adicionar secao "Usuarios com Maior Atividade"

#### 1.2 Alertas Criticos Inline
**Arquivo:** `src/pages/admin/AdminDashboard.tsx`
- Mover `DataIntegrityCard` para o topo do dashboard
- Mostrar apenas issues criticos e warnings em formato compacto
- Adicionar contador por severidade no header

---

### Fase 2: Sistema de Templates de Eventos

**Arquivo:** `src/types/eventTemplate.ts` (criar)
```typescript
interface EventTemplate {
  id: string;
  name: string;
  category: string;
  title_pattern: string;        // "Selic será maior que {valor}% em {mes}?"
  description: string;
  resolution: ResolutionSource;
  card_style: CardStyleType;
  recurrence_type: RecurrenceType;
  tags: string[];
  created_by: string;
  created_at: string;
}
```

**Arquivo:** `src/hooks/useEventTemplates.ts` (criar)
- `useEventTemplates()` - listar templates
- `useCreateTemplate()` - criar novo template
- `useDeleteTemplate()` - remover template
- `useApplyTemplate(templateId)` - preencher form com dados do template

**Arquivo:** `src/components/admin/EventTemplateSelector.tsx` (criar)
- Dropdown para selecionar template ao criar evento
- Preview dos campos que serao preenchidos
- Botao "Salvar como Template" no form de evento

**Arquivo:** `src/components/admin/DuplicateEventButton.tsx` (criar)
- Botao no `AdminEventDetailPage`
- Copia todos os campos do evento
- Ajusta datas automaticamente (+1 semana/mes baseado em recurrence_type)

**Migracao SQL:**
```sql
CREATE TABLE event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title_pattern TEXT NOT NULL,
  description TEXT,
  resolution JSONB,
  card_style TEXT DEFAULT 'default',
  recurrence_type TEXT DEFAULT 'none',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Fase 3: Monitoramento de Sistema

**Arquivo:** `supabase/functions/health-check/index.ts` (criar)
- Verificar conectividade com banco
- Testar autenticacao
- Retornar status de cada Edge Function
- Medir latencia de queries criticas

**Arquivo:** `src/pages/admin/AdminSystemPage.tsx` (criar)
- Tabela com todas as Edge Functions
- Status: Online (verde) / Degraded (amarelo) / Offline (vermelho)
- Tempo de resposta medio
- Ultimo erro registrado

**Arquivo:** `src/hooks/useSystemHealth.ts` (criar)
```typescript
interface EdgeFunctionHealth {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency_ms: number;
  last_error?: string;
  last_check: string;
}

interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  auth: 'healthy' | 'degraded' | 'down';
  functions: EdgeFunctionHealth[];
  metrics: {
    db_connections: number;
    avg_query_latency: number;
  }
}
```

**Arquivo:** `src/components/admin/AdminLayout.tsx`
- Adicionar item "Sistema" no menu lateral (icone: Activity)
- Path: `/admin/system`

---

### Fase 4: Exportacao e Relatorios

**Arquivo:** `src/hooks/useExport.ts` (criar)
- `exportToCSV(data, filename)` - ja existe em Ledger, extrair para hook
- `exportToExcel(data, filename)` - usar biblioteca `xlsx`
- `exportToPDF(data, filename, title)` - usar `html2canvas` + `jspdf`

**Arquivo:** `src/components/admin/ExportMenu.tsx` (criar)
- Dropdown com opcoes: CSV, Excel, PDF
- Recebe dados filtrados da tabela
- Mostra loading durante exportacao

**Paginas a modificar:**
- `AdminLedgerPage.tsx` - ja tem CSV, adicionar Excel/PDF
- `AdminUsersPage.tsx` - adicionar ExportMenu
- `AdminEventsPage.tsx` - adicionar ExportMenu
- `AdminAuditLogsPage.tsx` - adicionar ExportMenu

**Relatorios Predefinidos:**
**Arquivo:** `src/components/admin/ReportGenerator.tsx` (criar)
- Resumo Financeiro Mensal (receita, volume, fees)
- Atividade de Usuarios (novos, ativos, churn)
- Performance de Mercados (top 10, liquidacoes, contestacoes)
- Gerar PDF formatado com graficos

---

### Fase 5: UX e Produtividade

#### 5.1 Command Palette (Cmd+K)
**Arquivo:** `src/components/admin/AdminCommandPalette.tsx` (criar)
- Usar `CommandDialog` do shadcn/ui (ja disponivel)
- Grupos: Navegacao, Acoes Rapidas, Busca
- Acoes:
  - "Criar evento" -> `/admin/events/new`
  - "Liquidar [mercado]" -> abre lista de pendentes
  - "Bloquear usuario" -> abre dialog
  - "Ver metricas" -> `/admin/financial`
  - Navegar para qualquer pagina admin
- Busca fuzzy em eventos e usuarios

**Arquivo:** `src/components/admin/AdminLayout.tsx`
- Adicionar listener global para `Cmd+K` / `Ctrl+K`
- Renderizar `AdminCommandPalette` como modal
- Mostrar hint "⌘K" no header

#### 5.2 Favoritos/Fixados
**Arquivo:** `src/hooks/useFavoriteEvents.ts` (criar)
- Persistir em `localStorage`
- Lista de IDs de eventos favoritos
- Hook: `toggleFavorite(eventId)`, `isFavorite(eventId)`

**Arquivo:** `src/pages/admin/AdminEventsPage.tsx`
- Adicionar estrela em cada linha da tabela
- Filtro "Mostrar apenas favoritos"
- Eventos favoritos aparecem primeiro (ordenacao)

#### 5.3 Dark/Light Mode Toggle
**Arquivo:** `src/components/admin/ThemeToggle.tsx` (criar)
- Usar `next-themes` (ja instalado)
- Botao com icone sol/lua
- Toggle entre light/dark/system

**Arquivo:** `src/components/admin/AdminLayout.tsx`
- Adicionar `ThemeToggle` no header ao lado do nome do admin

---

### Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| **Criar** | `src/hooks/useAdminDashboardMetrics.ts` (modificar) |
| **Criar** | `src/components/admin/MetricCard.tsx` |
| **Criar** | `src/types/eventTemplate.ts` |
| **Criar** | `src/hooks/useEventTemplates.ts` |
| **Criar** | `src/components/admin/EventTemplateSelector.tsx` |
| **Criar** | `src/components/admin/DuplicateEventButton.tsx` |
| **Criar** | `supabase/functions/health-check/index.ts` |
| **Criar** | `src/pages/admin/AdminSystemPage.tsx` |
| **Criar** | `src/hooks/useSystemHealth.ts` |
| **Criar** | `src/hooks/useExport.ts` |
| **Criar** | `src/components/admin/ExportMenu.tsx` |
| **Criar** | `src/components/admin/ReportGenerator.tsx` |
| **Criar** | `src/components/admin/AdminCommandPalette.tsx` |
| **Criar** | `src/hooks/useFavoriteEvents.ts` |
| **Criar** | `src/components/admin/ThemeToggle.tsx` |
| **Modificar** | `src/pages/admin/AdminDashboard.tsx` |
| **Modificar** | `src/pages/admin/AdminEventFormPage.tsx` |
| **Modificar** | `src/pages/admin/AdminEventsPage.tsx` |
| **Modificar** | `src/components/admin/AdminLayout.tsx` |
| **SQL** | Criar tabela `event_templates` |

### Dependencias a Adicionar
- `xlsx` - exportacao Excel
- `jspdf` - geracao de PDF

### Ordem de Implementacao Sugerida
1. **Quick Wins** (1h): ThemeToggle, Command Palette basico
2. **Dashboard** (2h): MetricCard, comparativos, alertas inline
3. **Exportacao** (2h): hook useExport, ExportMenu, integrar em paginas
4. **Templates** (3h): tabela SQL, hooks, componentes, integracao
5. **Sistema** (2h): Edge Function health-check, pagina de monitoramento
6. **Favoritos** (1h): hook, integracao em AdminEventsPage
