

# Corrigir Vulnerabilidades de Segurança

## Resumo

Das 9 findings do scan, 3 sobre views (wallets_with_profile, payments_safe, wallets_safe) já estão corrigidas — todas possuem `security_invoker=true`. O scan reporta que "não há RLS na view", mas isso é esperado: com security_invoker, a RLS das tabelas subjacentes é aplicada automaticamente.

As correções reais são 4 mudanças no banco + 1 ação manual.

## Migration SQL

Uma única migration para corrigir todas as vulnerabilidades:

### 1. `user_achievements` — Remover INSERT para authenticated
- DROP policy "System can grant achievements"
- Achievements são concedidos apenas por database functions (SECURITY DEFINER) que já rodam como owner — não precisam de INSERT policy para `authenticated`

### 2. `referral_commissions` — Remover INSERT para authenticated
- DROP policy "System can insert commissions"  
- Comissões são inseridas por triggers/functions (SECURITY DEFINER) — não precisam de INSERT policy

### 3. `payments` — Restringir INSERT
- DROP policy "Users can create own payments"
- Criar nova policy que permite INSERT apenas com `auth.uid() = user_id` E restringe `status = 'PENDING'` e `fee = 0`
- Na prática, os pagamentos são criados pelas Edge Functions com `service_role`, mas a policy precisa existir como defesa em profundidade

### 4. `audit_logs` — Exigir user_id não nulo
- DROP policy "Authenticated users can insert own audit logs"
- Criar nova policy: `WITH CHECK (auth.uid() = user_id)` — sem permitir `user_id IS NULL`

### 5. Leaked Password Protection (Manual)
- Não é possível habilitar via migration — requer ação manual no dashboard do Supabase em **Authentication > Settings > Leaked Password Protection**

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| Nova migration SQL | Corrigir 4 policies de segurança |

Nenhum arquivo de código precisa ser alterado — todas as operações de INSERT nessas tabelas já são feitas via SECURITY DEFINER functions ou Edge Functions com service_role.

