

# Adicionar Link nas Notificações de Sugestão Aprovada/Rejeitada

## O que será feito

Adicionar navegação para a página da sugestão ao clicar nas notificações de aprovação/rejeição. A infraestrutura já existe — só falta mapear os dois tipos no switch de `getNotificationLink`.

## Arquivo: `src/components/notifications/NotificationBell.tsx`

Adicionar dois cases no `switch` da função `getNotificationLink` (~linha 105-107), junto com os outros tipos de sugestão:

```ts
case 'SUGGESTION_COMMENT_MENTION':
case 'SUGGESTION_COMMENT_REPLY':
case 'SUGGESTION_APPROVED':
case 'SUGGESTION_REJECTED':
  return data?.suggestion_id ? `/suggestions/${data.suggestion_id}` : '/suggestions';
```

Os dados `suggestion_id` já são incluídos no `data` das notificações pelo `NotificationService`. A função `handleNotificationClick` já usa `getNotificationLink` para navegar e marcar como lida.

Mudança de 2 linhas em 1 arquivo.

