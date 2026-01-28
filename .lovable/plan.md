

# Traduzir Todas as Ações dos Logs de Auditoria

## Problema
Algumas ações nos logs de auditoria aparecem sem tradução (ex: `market_settled`, `market_status_change`) porque o dicionário `ACTION_LABELS` só tem chaves em UPPERCASE, mas o banco de dados tem valores em lowercase.

## Solução

### Arquivo: `src/pages/admin/AdminAuditLogsPage.tsx`

**1. Expandir o dicionário ACTION_LABELS para incluir todas as variações:**

```typescript
const ACTION_LABELS: Record<string, string> = {
  // Regras de Taxa
  'FEE_RULE_CREATED': 'Regra Criada',
  'FEE_RULE_UPDATED': 'Regra Atualizada',
  'FEE_RULE_ACTIVATED': 'Regra Ativada',
  'FEE_RULE_DEACTIVATED': 'Regra Desativada',
  
  // Mercados (UPPERCASE)
  'MARKET_CLOSED': 'Mercado Fechado',
  'MARKET_SETTLED': 'Mercado Liquidado',
  'MARKET_STATUS_CHANGE': 'Status Alterado',
  'MARKET_CREATED': 'Mercado Criado',
  'MARKET_UPDATED': 'Mercado Atualizado',
  
  // Mercados (lowercase - compatibilidade)
  'market_closed': 'Mercado Fechado',
  'market_settled': 'Mercado Liquidado',
  'market_status_change': 'Status Alterado',
  'market_created': 'Mercado Criado',
  'market_updated': 'Mercado Atualizado',
  
  // Eventos
  'EVENT_SETTLED': 'Evento Liquidado',
  'EVENT_CREATED': 'Evento Criado',
  'EVENT_UPDATED': 'Evento Atualizado',
  
  // Usuários e Roles
  'ROLE_ASSIGNED': 'Role Atribuído',
  'ROLE_REMOVED': 'Role Removido',
  'USER_BLOCKED': 'Usuário Bloqueado',
  'USER_UNBLOCKED': 'Usuário Desbloqueado',
  'USER_WARNING_SENT': 'Aviso Enviado',
  
  // Carteiras
  'WALLET_ADJUSTED': 'Saldo Ajustado',
  'MANUAL_ADJUST': 'Ajuste Manual',
  
  // Pagamentos
  'WITHDRAWAL_COMPLETED': 'Saque Aprovado',
  'WITHDRAWAL_FAILED': 'Saque Rejeitado',
  'DEPOSIT_COMPLETED': 'Depósito Confirmado',
  'DEPOSIT_FAILED': 'Depósito Falhou',
};
```

**2. Atualizar o filtro de ações no Select para incluir novas opções:**

Adicionar os novos tipos de ação ao dropdown de filtro para que o administrador possa filtrar por eles.

---

## Detalhes Técnicos

| Ação no Banco | Tradução |
|---------------|----------|
| `market_settled` | Mercado Liquidado |
| `market_status_change` | Status Alterado |
| `market_closed` | Mercado Fechado |
| `MARKET_SETTLED` | Mercado Liquidado |
| `MARKET_STATUS_CHANGE` | Status Alterado |

## Resultado Esperado
Todas as badges de ação exibirão texto em português, independentemente do formato (UPPERCASE ou lowercase) armazenado no banco de dados.

