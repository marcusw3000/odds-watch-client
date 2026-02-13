

# Correção de Vulnerabilidade Crítica: Escalação de Privilégios em `user_roles`

## Problema Identificado

A tabela `user_roles` tem grants excessivos no nível do banco de dados:

| Role PostgreSQL | INSERT | UPDATE | DELETE |
|---|---|---|---|
| `anon` | SIM | SIM | - |
| `authenticated` | SIM | SIM | SIM |

Embora as políticas RLS exijam `has_role(auth.uid(), 'admin')` para escrita, os grants brutos permitem que qualquer usuário tente manipular a tabela diretamente via o cliente Supabase no navegador.

## Solução

### 1. Revogar Grants Desnecessários (Migration SQL)

Remover INSERT/UPDATE/DELETE dos roles `anon` e `authenticated`. Manter apenas SELECT (necessário para o `has_role()` funcionar via RLS).

```sql
-- Revogar permissões de escrita
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- Garantir que SELECT permanece (para has_role funcionar)
GRANT SELECT ON public.user_roles TO anon, authenticated;
```

### 2. Adicionar WITH CHECK Explícito na Política RLS

Reforçar a política "Admins can manage roles" com WITH CHECK explícito:

```sql
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
```

Mudancas importantes:
- `TO authenticated` em vez de `TO public` (exclui `anon` completamente)
- `WITH CHECK` explícito em vez de implícito (nil)

### 3. Verificar Audit Trail

Após aplicar, verificar se houve inserções não autorizadas:

```sql
SELECT * FROM user_roles 
WHERE created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

## Impacto

- Nenhuma funcionalidade é afetada (todas as operações de escrita em `user_roles` são feitas via Edge Functions com `service_role`, que bypassa RLS e grants)
- O `useAuth` hook continua funcionando normalmente (usa `has_role` RPC que é SECURITY DEFINER)
- Segurança reforçada em duas camadas: grants + RLS

## Arquivo Alterado

- Nova migration SQL em `supabase/migrations/` com os comandos REVOKE/GRANT e recriação da policy

