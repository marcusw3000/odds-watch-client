
# Corrigir Logs de Auditoria Vazios

## Problema
A página de Logs de Auditoria (`/admin/audit-logs`) mostra "Nenhum log de auditoria encontrado" apesar de existirem 9 registros no banco de dados.

## Causa Raiz
A query do frontend tenta fazer um JOIN implícito:
```typescript
.select('*, profiles:actor_user_id(display_name)')
```

Porém, a tabela `admin_audit_logs` **não possui uma Foreign Key** para `profiles`. O PostgREST retorna erro 400:
> "Could not find a relationship between 'admin_audit_logs' and 'actor_user_id'"

O código silenciosamente retorna um array vazio quando há erro.

---

## Solução

### 1. Migração SQL - Adicionar Foreign Key

Criar FK de `actor_user_id` referenciando `profiles.id`:

```sql
ALTER TABLE admin_audit_logs
ADD CONSTRAINT admin_audit_logs_actor_user_id_fkey
FOREIGN KEY (actor_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
```

**Nota:** Precisamos alterar a coluna para permitir NULL antes (caso o profile seja deletado):

```sql
-- Permitir NULL para suportar ON DELETE SET NULL
ALTER TABLE admin_audit_logs 
ALTER COLUMN actor_user_id DROP NOT NULL;

-- Adicionar FK
ALTER TABLE admin_audit_logs
ADD CONSTRAINT admin_audit_logs_actor_user_id_fkey
FOREIGN KEY (actor_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
```

---

## Detalhes Técnicos

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| Query | `src/services/FinancialRepository.ts` | Linha ~397 - já usa sintaxe correta para JOIN |
| Tabela | `admin_audit_logs` | Falta FK para `profiles` |
| Erro | PostgREST | 400 - Relacionamento não encontrado |

### Estado Atual
- Total de logs no banco: **9 registros**
- RLS: Configurado corretamente (admins podem SELECT/INSERT)
- A query está correta, apenas falta a FK no schema

### Resultado Esperado
Após a migração, os logs de auditoria aparecerão normalmente com o nome do ator (admin) exibido corretamente.
