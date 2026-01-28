

# Adicionar "Configurações" no Menu Dropdown do Perfil

## Problema

O menu dropdown do usuário no Header possui várias opções, mas não inclui um link para a página de Configurações (`/settings`). Atualmente existe apenas um link para "Suporte" que direciona para `/settings?tab=support`.

## Solução

Adicionar um novo item de menu "Configurações" no dropdown do perfil, posicionado de forma lógica próximo aos outros itens de configuração do usuário.

## Alterações

### Arquivo: `src/components/layout/Header.tsx`

**1. Importar o ícone Settings:**

Adicionar `Settings` na importação do lucide-react (linha 3).

**2. Adicionar item no dropdown desktop (após "Meu Perfil"):**

```tsx
<DropdownMenuItem asChild>
  <Link to="/settings">
    <Settings className="mr-2 h-4 w-4" />
    Configurações
  </Link>
</DropdownMenuItem>
```

**3. Adicionar botão no menu mobile:**

```tsx
<Button
  variant="ghost"
  className="justify-start gap-2"
  onClick={() => setMobileMenuOpen(false)}
  asChild
>
  <Link to="/settings">
    <Settings className="h-4 w-4" />
    Configurações
  </Link>
</Button>
```

## Estrutura Final do Menu

| Item | Rota | Ícone |
|------|------|-------|
| Meu Perfil | /profile | User |
| **Configurações** | **/settings** | **Settings** |
| Copy Trading | /copy-traders | Users |
| Indicar Amigos | /referral | Gift |
| Taxas | /fees | Calculator |
| Suporte | /settings?tab=support | Headphones |
| --- | --- | --- |
| Sair | (logout) | LogOut |

## Benefícios

- Acesso direto às configurações sem precisar navegar por outras páginas
- Consistência com o padrão de UX esperado
- O item "Suporte" continua sendo um atalho direto para a tab de suporte

