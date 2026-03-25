

# Notificar Autor quando Sugestão for Aprovada/Rejeitada

## O que será feito

Enviar notificação in-app ao autor da sugestão quando um admin aprovar ou rejeitar.

## Arquivos a modificar

| Arquivo | Ação |
|---|---|
| `src/types/notification.ts` | Adicionar tipos `SUGGESTION_APPROVED` e `SUGGESTION_REJECTED` |
| `src/services/NotificationService.ts` | Adicionar helpers `notifySuggestionApproved` e `notifySuggestionRejected` |
| `src/pages/admin/AdminSuggestionsPage.tsx` | Chamar notificação após approve/reject bem-sucedidos |

## Detalhes

1. **Tipos**: Adicionar `'SUGGESTION_APPROVED' | 'SUGGESTION_REJECTED'` ao union `NotificationType`.

2. **NotificationService**: Duas novas funções:
   - `notifySuggestionApproved(userId, suggestionId, suggestionTitle)` — tipo `SUGGESTION_APPROVED`, com `sendEmail: true`
   - `notifySuggestionRejected(userId, suggestionId, suggestionTitle, reason)` — tipo `SUGGESTION_REJECTED`, com `sendEmail: true`

3. **AdminSuggestionsPage**: Após `SuggestionService.reviewSuggestion` retornar com sucesso:
   - Em `handleApprove`: chamar `notifySuggestionApproved(selectedSuggestion.user_id, selectedSuggestion.id, selectedSuggestion.title)`
   - Em `handleReject`: chamar `notifySuggestionRejected(selectedSuggestion.user_id, selectedSuggestion.id, selectedSuggestion.title, adminNotes)`
   - Falha na notificação não bloqueia o fluxo (try/catch isolado)

4. **Migration**: Adicionar os novos valores ao enum `notification_type` no banco se existir como enum PostgreSQL.

