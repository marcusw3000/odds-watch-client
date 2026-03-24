
Problema real identificado: não é só o chat. O preview ainda está preso em skeletons porque o browser continua tentando carregar o módulo antigo `src/hooks/useAuth.ts` e recebe 404. Eu confirmei isso no console remoto:

```text
Failed to load resource: 404 ()
.../src/hooks/useAuth.ts?t=...
```

Como consequência, a árvore de auth quebra antes de estabilizar, vários componentes não inicializam corretamente e a tela fica no estado de carregamento.

Plano mínimo e seguro:

1. Restaurar um ponto de import estável para `@/hooks/useAuth`
   - Criar `src/hooks/useAuth.ts` novamente como arquivo “shim” estável.
   - Esse arquivo deve apenas reexportar `useAuth` e `AuthProvider` de um novo arquivo base, sem JSX.

2. Mover a implementação atual para um nome novo
   - Renomear a implementação atual para algo como `src/hooks/useAuthContext.tsx`.
   - Manter ali toda a lógica existente de `AuthProvider`, `AuthContext`, `defaultAuthState` e `useAuth`.

3. Atualizar imports para usar o ponto estável
   - Padronizar imports do app para continuarem apontando para `@/hooks/useAuth`.
   - `App.tsx` continuará importando `AuthProvider` desse caminho estável.

4. Preservar os guards já adicionados
   - Manter `useAuth()` retornando `defaultAuthState` quando o contexto ainda não estiver disponível.
   - Manter o `ChatErrorBoundary` com botão fallback, porque isso continua sendo útil se o chat falhar isoladamente.

5. Verificação esperada após a correção
   - O 404 de `useAuth.ts` desaparece.
   - A home deixa de ficar presa em skeletons.
   - O botão do chat volta a aparecer após recarregar com F5.
   - O problema fica resolvido de forma robusta, sem depender de limpar cache/HMR manualmente.

Detalhe técnico importante:
- A correção anterior atacou o sintoma, mas não a compatibilidade do caminho antigo.
- O jeito mais seguro é reintroduzir `src/hooks/useAuth.ts` como “entrypoint” permanente e mover a implementação JSX para outro arquivo com nome diferente. Assim, mesmo que o navegador/dev server ainda peça `useAuth.ts`, o arquivo existe e responde corretamente.
