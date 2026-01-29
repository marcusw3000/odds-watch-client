
# Plano: Corrigir Processamento de Payouts Após Liquidação

## Problema Identificado

Os payouts não estão sendo executados corretamente após a liquidação de mercados porque:

1. A função `process_market_payouts` mais recente (migração `20260128043322`) **substituiu** a versão anterior que suportava mercados multi-opção
2. A versão atual só processa contratos com `position = 'YES'` ou `position = 'NO'`
3. Mercados MULTIPLE têm contratos com `position = 'OPTION'` e usam o campo `option_id` para identificar qual opção foi comprada
4. Resultado: contratos de mercados multi-opção nunca são identificados como vencedores

## Evidência do Problema

```text
Mercado MULTIPLE "978295c5..." liquidado com result='YES'
├── Contratos existentes: position='OPTION', option_id='207831d4...'
├── Função busca: position = 'YES' 
└── Resultado: 0 contratos encontrados → 0 payouts

Ledger entries de SETTLEMENT para mercados recentes: ZERO
```

## Solução

Atualizar a função `process_market_payouts` para:

1. Detectar se é um mercado MULTIPLE (verificando `market_type` ou se o resultado é um UUID)
2. Para mercados BINARY: manter lógica atual (`position = 'YES'/'NO'`)
3. Para mercados MULTIPLE: identificar vencedores pelo `option_id` do contrato

## Alterações Técnicas

### Migração SQL: Atualizar `process_market_payouts`

A função precisa:

```text
1. Verificar tipo do mercado (BINARY vs MULTIPLE)

2. Para BINARY:
   - Vencedores: position = resultado ('YES' ou 'NO')

3. Para MULTIPLE:
   - Resultado é um UUID (option_id vencedor)
   - Vencedores YES: option_id = winning_option_id
   - Vencedores NO: option_id ≠ winning_option_id
   
4. Para ambos:
   - Creditar balance_available
   - Criar ledger_entry com ref_type='SETTLEMENT'
   - Enviar notificação ao usuário
   - Aplicar taxa de liquidação configurada
```

### Lógica de Detecção (Pseudocódigo)

```sql
-- Detectar tipo de mercado
IF p_winning_outcome ~ '^[0-9a-f-]{36}$' THEN
  -- É UUID = mercado multi-opção
  v_winning_option_id := p_winning_outcome::UUID;
  
  -- Vencedores: contracts onde option_id = v_winning_option_id
  -- OU contracts NO onde option_id ≠ v_winning_option_id
ELSE
  -- É YES/NO = mercado binário
  -- Manter lógica atual
END IF;
```

### Atualização da UI de Liquidação (AdminSettlementsPage)

Para mercados MULTIPLE, a interface precisa permitir selecionar **qual opção venceu** (não apenas YES/NO):

1. Detectar se mercado é MULTIPLE
2. Se for, carregar lista de `market_options`
3. Exibir seletor com as opções disponíveis
4. Enviar o `option_id` vencedor como resultado (em vez de 'YES'/'NO')

### Arquivos a Modificar

1. **Nova migração SQL**: Recriar `process_market_payouts` com suporte a multi-opção
2. **`src/pages/admin/AdminSettlementsPage.tsx`**: Adicionar seletor de opção vencedora
3. **`supabase/functions/update-admin-event/index.ts`**: Aceitar UUID como resultado válido

## Fluxo Corrigido

```text
Admin acessa /admin/settlements
         │
         ▼
   Seleciona mercado
         │
    ┌────┴────┐
    │         │
 BINARY    MULTIPLE
    │         │
    ▼         ▼
 SIM/NÃO   Dropdown de opções
    │         │
    └────┬────┘
         │
         ▼
   Confirma liquidação
         │
         ▼
 update-admin-event (action: 'settle')
         │
         ▼
 process_market_payouts(market_id, resultado)
         │
    ┌────┴────┐
    │         │
 BINARY    MULTIPLE
    │         │
    ▼         ▼
position   option_id
= 'YES'    = UUID vencedor
    │         │
    └────┬────┘
         │
         ▼
   Credita wallets
   Cria ledger entries
   Envia notificações
```

## Resumo das Mudanças

| Componente | Alteração |
|------------|-----------|
| `process_market_payouts` | Adicionar lógica para detectar e processar mercados MULTIPLE |
| `AdminSettlementsPage` | Exibir opções para mercados MULTIPLE em vez de apenas SIM/NÃO |
| `update-admin-event` | Aceitar UUID como resultado válido para liquidação |

## Resultado Esperado

1. Admin liquida mercado BINARY → payouts para position='YES' ou 'NO'
2. Admin liquida mercado MULTIPLE → payouts para contratos da opção vencedora
3. Ledger entries criados corretamente
4. Wallets creditados
5. Notificações enviadas aos usuários
