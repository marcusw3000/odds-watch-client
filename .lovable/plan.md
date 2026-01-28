

# Integrar Configurações do Perfil na Tab Perfil

## Problema Atual

A tab "Perfil" na página de Configurações (`/settings`) mostra apenas um botão que redireciona para `/profile?tab=settings`. Isso é confuso para o usuário, que espera encontrar as configurações diretamente ali.

## Solução

Integrar o componente `ProfilePrivacySettings` diretamente na tab "Perfil" da página de Configurações, eliminando o redirecionamento desnecessário.

## Alterações

### Arquivo: `src/pages/SettingsPage.tsx`

1. Importar os hooks necessários para obter dados do perfil
2. Importar o componente `ProfilePrivacySettings`
3. Substituir o card com botão de redirecionamento pelo componente de configurações

### Mudanças Específicas

| Item | Antes | Depois |
|------|-------|--------|
| Tab Perfil | Botão "Ir para Configurações do Perfil" | Formulário completo com nome, bio, visibilidade |
| Imports | Apenas componentes básicos | Adicionar hooks de leaderboard e ProfilePrivacySettings |
| UX | 2 cliques para chegar nas configurações | Acesso direto na página de configurações |

### Código

A tab "Perfil" passará de:

```tsx
<TabsContent value="profile">
  <Card>
    <CardHeader>
      <CardTitle>Configurações de Perfil</CardTitle>
      <CardDescription>...</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild>
        <Link to="/profile?tab=settings">Ir para Configurações do Perfil</Link>
      </Button>
    </CardContent>
  </Card>
</TabsContent>
```

Para:

```tsx
<TabsContent value="profile">
  {profileLoading ? (
    <Card><CardContent>Loading...</CardContent></Card>
  ) : profile ? (
    <ProfilePrivacySettings
      profile={profile}
      onUpdate={handleUpdateProfile}
    />
  ) : (
    <Card><CardContent>Erro ao carregar perfil</CardContent></Card>
  )}
</TabsContent>
```

## Dependências Necessárias

Os seguintes hooks já existem e serão reutilizados:
- `useMyLeaderboardProfile` - obtém dados do perfil do usuário
- `useMyStatistics` - obtém estatísticas do usuário
- `useUpdateLeaderboardProfile` - atualiza o perfil

## Resultado Final

O usuário terá acesso direto às configurações do perfil (nome de exibição, bio, participação no leaderboard, métricas visíveis) diretamente na tab "Perfil" da página de Configurações, sem precisar de redirecionamento.

