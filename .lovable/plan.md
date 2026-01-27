
# Plano Completo de Finalização do OddsWatch

## Resumo Executivo

Este documento estrutura **todas as pendências** identificadas no projeto OddsWatch, organizadas por prioridade e interdependência. O objetivo é transformar o MVP atual em uma plataforma operacional completa.

---

## Legenda de Prioridades

| Prioridade | Significado | Prazo Sugerido |
|------------|-------------|----------------|
| **P0** | Crítico - Bloqueia operação | Imediato |
| **P1** | Alto - Segurança/Compliance | 1 semana |
| **P2** | Médio - Funcionalidade core | 2 semanas |
| **P3** | Baixo - Nice-to-have | Backlog |

---

## P0 - CRÍTICO: Automação de Ciclo de Vida

### 1. Cron Job: Expiração Automática de Mercados

**Problema:** Mercados permanecem `OPEN` após `close_date` expirar. Admins precisam fechar manualmente cada um.

**Solução:**
- Criar Edge Function `auto-expire-markets`
- Executar via pg_cron a cada 5 minutos
- Lógica:
  - Mercados `OPEN` com `close_date < NOW()` → mudar para `PENDING`
  - Mercados econômicos `PENDING` → chamar `bcb-data-fetcher` e definir resultado
  - Mercados com resultado há 48h sem contestação → mudar para `SETTLED`

**Arquivos a criar:**
```
supabase/functions/auto-expire-markets/index.ts
```

**SQL para pg_cron:**
```sql
SELECT cron.schedule(
  'auto-expire-markets',
  '*/5 * * * *', -- a cada 5 minutos
  $$
  SELECT net.http_post(
    url:='https://nfwxyftsdhgxfrnrvsdo.supabase.co/functions/v1/auto-expire-markets',
    headers:='{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

### 2. Automação de Liquidação Econômica

**Problema:** Mercados com `settlement_type` econômico (SELIC, IPCA, PTAX) precisam consultar API BCB e liquidar automaticamente.

**Solução:**
- Integrar `check-economic-events` (já existe) no cron
- Após definir resultado, iniciar período de contestação (48h)
- Após contestação, executar `process_market_payouts`

**Fluxo completo:**
```
close_date passa
     ↓
OPEN → PENDING
     ↓
BCB API → define resultado
     ↓
PENDING → CONTESTED (48h)
     ↓
Sem contestação aceita
     ↓
CONTESTED → SETTLED + process_market_payouts()
```

**Arquivos a modificar:**
```
supabase/functions/auto-expire-markets/index.ts (integrar todo o fluxo)
supabase/functions/check-economic-events/index.ts (já existe, revisar)
```

---

### 3. Processamento Automático de Payouts

**Problema:** `process_market_payouts` precisa ser chamado manualmente.

**Solução:**
- No cron, após 48h em CONTESTED sem contestação aceita:
  - Atualizar status para SETTLED
  - Executar RPC `process_market_payouts`

**Arquivos a modificar:**
```
supabase/functions/auto-expire-markets/index.ts
```

---

## P1 - SEGURANÇA

### 4. Corrigir Políticas RLS Permissivas

**Problema:** 2 políticas com `USING (true)` para INSERT/UPDATE na tabela `daily_volume_snapshots`.

**Solução:**
- Revisar policies da tabela
- Restringir INSERT apenas para service_role (cron jobs)

**SQL a executar:**
```sql
-- Revogar policy permissiva
DROP POLICY IF EXISTS "Allow insert for volume snapshots" ON daily_volume_snapshots;

-- Criar policy restritiva (apenas service_role via functions)
-- A tabela só deve ser modificada por Edge Functions, não diretamente por usuários
```

---

### 5. Ativar Proteção de Senhas Vazadas

**Problema:** Supabase Auth está sem proteção contra senhas comprometidas.

**Solução:**
- Acessar Dashboard Supabase → Authentication → Settings
- Ativar "Leaked Password Protection"

**Ação:** Configuração manual no dashboard (não requer código)

---

## P2 - FUNCIONALIDADES CORE

### 6. Sistema de Contestações (Backend)

**Problema:** Frontend tem UI completa, mas `onSubmitContestation` é apenas `console.log`.

**Situação atual:**
- Tabela `contestations` existe no banco
- Trigger `trigger_notify_admin_new_contestation` existe
- Falta: Edge Function para submeter + painel admin para revisar

**Solução:**

**Parte A - Edge Function para submeter:**
```
supabase/functions/submit-contestation/index.ts
```
- Validar usuário autenticado
- Validar que mercado está em status CONTESTED
- Validar que período de contestação não expirou
- Inserir na tabela `contestations`
- Retornar sucesso

**Parte B - Modificar frontend:**
```
src/pages/MarketDetailPage.tsx (linha 493-496)
```
- Trocar `console.log` por chamada real ao Edge Function

**Parte C - Painel admin para revisar:**
```
src/pages/admin/AdminContestationsPage.tsx (novo)
```
- Listar contestações pendentes
- Aprovar/Rejeitar com notas
- Se aprovada, reverter resultado do mercado

---

### 7. Compra de NÃO em Mercados Múltiplos

**Problema:** Botão "Comprar NÃO" em mercados com múltiplas opções está com `toast("Em breve!")`.

**Solução:**
- Comprar NÃO na opção X = Comprar SIM em todas as outras opções proporcionalmente
- Usar `execute-multi-trade-batch` (a criar) para operação atômica

**Arquivos a criar/modificar:**
```
supabase/functions/execute-multi-trade-batch/index.ts (novo)
src/components/market/MultiOptionTradingPanel.tsx (linha 82)
src/pages/MarketDetailPage.tsx
```

**Lógica matemática:**
```
Preço NÃO em X = Soma dos preços SIM de todas as outras opções
Comprar NÃO em X = Comprar SIM em (Y, Z, W...) proporcional ao preço de cada
```

---

### 8. Migrar Comentários para Banco de Dados

**Problema:** Comentários são mock hardcoded em `MarketDataProvider.ts`.

**Situação atual:**
- `mockComments: Record<string, Comment[]> = {}` (vazio)
- Tabela `comments` existe no banco
- Falta: Queries reais + realtime

**Solução:**
- Criar serviço `CommentService.ts` (já existe, verificar se usa DB)
- Substituir mock por queries Supabase
- Adicionar realtime subscription para novos comentários

**Arquivos a modificar:**
```
src/services/CommentService.ts
src/services/MarketDataProvider.ts (remover mockComments)
src/components/market/CommentSection.tsx
```

---

### 9. Remover Mock Markets

**Problema:** 90+ linhas de mercados mock em `MarketDataProvider.ts`.

**Solução:**
- Verificar que existem mercados reais no banco
- Remover array `mockMarkets`
- Ajustar `getEvents()` para retornar lista vazia se DB vazio (em vez de mocks)

**Arquivos a modificar:**
```
src/services/MarketDataProvider.ts (linhas 90-245)
```

---

## P3 - MELHORIAS E OBSERVABILIDADE

### 10. Integração Sentry Completa

**Problema:** `logger.ts` tem placeholder para Sentry, mas não está integrado.

**Situação atual:**
- Sentry importado em `main.tsx` e `ErrorBoundary.tsx`
- `logger.ts` tem função `sendToExternalService` vazia

**Solução:**
- Integrar `logger.error()` com `Sentry.captureException()`
- Configurar alertas para erros críticos
- Adicionar logging em Edge Functions

**Arquivos a modificar:**
```
src/lib/logger.ts
supabase/functions/_shared/logging.ts
```

---

### 11. Notificações por Email de Trades

**Problema:** Usuários não recebem confirmação por email após compra/venda.

**Solução:**
- Modificar `execute-trade` e `execute-sell` para chamar `send-notification-email`
- Template: "Você comprou X contratos SIM em [Mercado] por R$Y"

**Arquivos a modificar:**
```
supabase/functions/execute-trade/index.ts
supabase/functions/execute-sell/index.ts
```

---

### 12. Recorrência de Mercados

**Problema:** Campo `recurrence_type` existe, mas lógica de criar mercados recorrentes não está implementada.

**Solução:**
- Criar Edge Function `create-recurring-markets`
- Executar via cron diariamente
- Duplicar mercados com recurrence_type != 'none' quando expiram

**Arquivos a criar:**
```
supabase/functions/create-recurring-markets/index.ts
```

---

## Diagrama de Dependências

```text
+------------------------+
|   P0: AUTOMAÇÃO        |
|------------------------|
| 1. auto-expire-markets |----+
| 2. check-economic      |    |
| 3. process-payouts     |----+---> Requer tabelas + RPCs existentes
+------------------------+

+------------------------+
|   P1: SEGURANÇA        |
|------------------------|
| 4. RLS daily_volume    |-----> Independente
| 5. Leaked passwords    |-----> Config manual
+------------------------+

+------------------------+
|   P2: FEATURES         |
|------------------------|
| 6. Contestações        |-----> Depende de P0.1 (status CONTESTED)
| 7. Multi-option NÃO    |-----> Depende de LMSR multi
| 8. Comentários DB      |-----> Independente
| 9. Remover mocks       |-----> Após verificar dados reais
+------------------------+

+------------------------+
|   P3: MELHORIAS        |
|------------------------|
| 10. Sentry             |-----> Independente
| 11. Email trades       |-----> Após execute-trade estável
| 12. Recorrência        |-----> Após P0.1 (auto-expire)
+------------------------+
```

---

## Ordem de Implementação Sugerida

| Sprint | Tarefas | Esforço |
|--------|---------|---------|
| **1** | P0.1, P0.2, P0.3 (Automação completa) | 3-4 dias |
| **2** | P1.4, P1.5 (Segurança) | 1 dia |
| **3** | P2.6 (Contestações) | 2 dias |
| **4** | P2.7 (Multi NÃO), P2.8 (Comentários) | 2 dias |
| **5** | P2.9 (Mocks), P3.10 (Sentry) | 1 dia |
| **6** | P3.11 (Emails), P3.12 (Recorrência) | 2 dias |

**Total estimado: 11-12 dias de desenvolvimento**

---

## Seção Técnica: Detalhes de Implementação

### Edge Function: auto-expire-markets

```typescript
// Pseudocódigo da lógica principal
Deno.serve(async (req) => {
  // 1. Buscar mercados OPEN com close_date < now()
  const expiredOpen = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'OPEN')
    .lt('close_date', new Date().toISOString());

  // 2. Para cada mercado expirado:
  for (const market of expiredOpen) {
    // Se econômico, buscar resultado na BCB API
    if (market.settlement_type !== 'MANUAL') {
      const result = await fetchBCBResult(market);
      await supabase.from('markets').update({
        status: 'CONTESTED',
        result: result,
        settlement_date: addHours(new Date(), 48)
      }).eq('id', market.id);
    } else {
      // Manual: apenas marcar como PENDING
      await supabase.from('markets').update({
        status: 'PENDING'
      }).eq('id', market.id);
    }
  }

  // 3. Buscar mercados CONTESTED há mais de 48h
  const readyToSettle = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'CONTESTED')
    .lt('settlement_date', new Date().toISOString());

  // 4. Para cada mercado pronto:
  for (const market of readyToSettle) {
    // Verificar se há contestação aceita
    const { data: accepted } = await supabase
      .from('contestations')
      .select('id')
      .eq('market_id', market.id)
      .eq('status', 'APPROVED')
      .limit(1);

    if (!accepted?.length) {
      // Sem contestação aceita: liquidar
      await supabase.rpc('process_market_payouts', {
        p_market_id: market.id,
        p_winning_outcome: market.result
      });
      await supabase.from('markets').update({
        status: 'SETTLED'
      }).eq('id', market.id);
    }
  }
});
```

### Edge Function: submit-contestation

```typescript
Deno.serve(async (req) => {
  const { marketId, reason, evidenceUrl } = await req.json();
  
  // Validações
  const { data: market } = await supabase
    .from('markets')
    .select('status, settlement_date')
    .eq('id', marketId)
    .single();

  if (market?.status !== 'CONTESTED') {
    return error("Mercado não está em período de contestação");
  }

  if (new Date(market.settlement_date) < new Date()) {
    return error("Período de contestação encerrado");
  }

  // Inserir contestação
  const { error } = await supabase.from('contestations').insert({
    market_id: marketId,
    user_id: user.id,
    reason,
    evidence_url: evidenceUrl,
    status: 'PENDING'
  });

  // Trigger notify_admin_new_contestation é automático
  return success();
});
```

---

## Checklist Final

- [x] P0.1 - Edge Function auto-expire-markets ✅
- [x] P0.2 - Integrar check-economic-events no cron ✅
- [x] P0.3 - Processar payouts automaticamente ✅
- [x] P1.4 - Corrigir RLS daily_volume_snapshots ✅
- [ ] P1.5 - Ativar leaked password protection (⚠️ Ação manual no Dashboard Supabase)
- [ ] P2.6 - Edge Function submit-contestation + Admin UI
- [ ] P2.7 - Implementar compra NÃO em múltiplos
- [ ] P2.8 - Migrar comentários para DB real
- [ ] P2.9 - Remover mock markets
- [ ] P3.10 - Integrar Sentry no logger
- [ ] P3.11 - Emails de confirmação de trades
- [ ] P3.12 - Criar mercados recorrentes automaticamente
