import { supabase } from '@/integrations/supabase/client';
import type { NotificationType } from '@/types/notification';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  sendEmail?: boolean;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  data = {},
  sendEmail = false,
}: CreateNotificationParams): Promise<string | null> {
  try {
    // Insert notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: type as any, // Type assertion for new notification types until types are regenerated
        title,
        message,
        data,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    // Optionally send email
    if (sendEmail && notification) {
      try {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            user_id: userId,
            type,
            title,
            message,
            data: { ...data, notification_id: notification.id },
          },
        });
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    return notification.id;
  } catch (error) {
    console.error('Error in createNotification:', error);
    return null;
  }
}

// Helper functions for specific notification types
export async function notifyMarketClosingSoon(
  userId: string,
  marketId: string,
  marketTitle: string,
  timeRemaining: string
) {
  return createNotification({
    userId,
    type: 'MARKET_CLOSING_SOON',
    title: 'Mercado Fechando em Breve',
    message: `"${marketTitle}" fecha em ${timeRemaining}. Última chance de apostar!`,
    data: { market_id: marketId, market_title: marketTitle, time_remaining: timeRemaining },
    sendEmail: true,
  });
}

export async function notifyMarketSettled(
  userId: string,
  marketId: string,
  marketTitle: string,
  result: string,
  profit?: number
) {
  return createNotification({
    userId,
    type: 'MARKET_SETTLED',
    title: 'Mercado Liquidado',
    message: `"${marketTitle}" foi liquidado. Resultado: ${result}${profit !== undefined ? `. Seu lucro: R$${profit.toFixed(2)}` : ''}`,
    data: { market_id: marketId, market_title: marketTitle, result, profit },
    sendEmail: true,
  });
}

export async function notifyTradeExecuted(
  userId: string,
  marketId: string,
  marketTitle: string,
  position: string,
  shares: number,
  totalAmount: number
) {
  return createNotification({
    userId,
    type: 'TRADE_EXECUTED',
    title: 'Trade Executado',
    message: `Compra de ${shares} contratos ${position} em "${marketTitle}" por R$${totalAmount.toFixed(2)}`,
    data: { market_id: marketId, market_title: marketTitle, position, shares, total_amount: totalAmount },
    sendEmail: false,
  });
}

export async function notifyAchievementUnlocked(
  userId: string,
  achievementName: string,
  achievementIcon: string,
  points: number
) {
  return createNotification({
    userId,
    type: 'ACHIEVEMENT_UNLOCKED',
    title: 'Conquista Desbloqueada! 🎉',
    message: `Você desbloqueou "${achievementName}" e ganhou ${points} pontos!`,
    data: { achievement_name: achievementName, achievement_icon: achievementIcon, points },
    sendEmail: false,
  });
}

export async function notifyCommentMention(
  userId: string,
  mentionedByName: string,
  marketId: string,
  marketTitle: string,
  commentPreview: string
) {
  return createNotification({
    userId,
    type: 'COMMENT_MENTION',
    title: `${mentionedByName} mencionou você`,
    message: `Em "${marketTitle}": "${commentPreview}..."`,
    data: { market_id: marketId, mentioned_by: mentionedByName },
    sendEmail: true,
  });
}

export async function notifyCommentLike(
  userId: string,
  likedByName: string,
  marketId: string,
  marketTitle: string,
  likesCount: number
) {
  return createNotification({
    userId,
    type: 'COMMENT_LIKE',
    title: `${likedByName} curtiu seu comentário`,
    message: `Seu comentário em "${marketTitle}" tem ${likesCount} ${likesCount === 1 ? 'curtida' : 'curtidas'}`,
    data: { market_id: marketId, liked_by: likedByName, likes_count: likesCount },
    sendEmail: false,
  });
}

export async function notifyCommentReply(
  userId: string,
  repliedByName: string,
  marketId: string,
  marketTitle: string,
  replyPreview: string
) {
  return createNotification({
    userId,
    type: 'COMMENT_REPLY',
    title: `${repliedByName} respondeu ao seu comentário`,
    message: `Em "${marketTitle}": "${replyPreview}..."`,
    data: { market_id: marketId, replied_by: repliedByName },
    sendEmail: false,
  });
}

// New notification types for deposits/withdrawals
export async function notifyDepositConfirmed(
  userId: string,
  amount: number,
  paymentId?: string
) {
  return createNotification({
    userId,
    type: 'DEPOSIT_CONFIRMED',
    title: 'Depósito Confirmado! 💰',
    message: `Seu depósito de R$${amount.toFixed(2)} foi creditado com sucesso.`,
    data: { amount, payment_id: paymentId },
    sendEmail: false,
  });
}

export async function notifyWithdrawalRequested(
  userId: string,
  amount: number,
  paymentId?: string
) {
  return createNotification({
    userId,
    type: 'WITHDRAWAL_REQUESTED',
    title: 'Solicitação de Saque Recebida',
    message: `Seu saque de R$${amount.toFixed(2)} está sendo processado.`,
    data: { amount, payment_id: paymentId },
    sendEmail: false,
  });
}

export async function notifyWithdrawalCompleted(
  userId: string,
  amount: number,
  paymentId?: string
) {
  return createNotification({
    userId,
    type: 'WITHDRAWAL_COMPLETED',
    title: 'Saque Concluído! ✅',
    message: `Seu saque de R$${amount.toFixed(2)} foi processado com sucesso.`,
    data: { amount, payment_id: paymentId },
    sendEmail: true,
  });
}

export async function notifyWithdrawalFailed(
  userId: string,
  amount: number,
  reason: string,
  paymentId?: string
) {
  return createNotification({
    userId,
    type: 'WITHDRAWAL_FAILED',
    title: 'Saque Não Processado',
    message: `Seu saque de R$${amount.toFixed(2)} não pôde ser processado. ${reason}`,
    data: { amount, reason, payment_id: paymentId },
    sendEmail: true,
  });
}

export async function notifyPriceAlert(
  userId: string,
  marketId: string,
  marketTitle: string,
  oldPrice: number,
  newPrice: number,
  percentChange: number
) {
  const direction = percentChange > 0 ? 'subiu' : 'caiu';
  return createNotification({
    userId,
    type: 'PRICE_ALERT',
    title: 'Alerta de Preço 📊',
    message: `"${marketTitle}" ${direction} ${Math.abs(percentChange).toFixed(2)}%`,
    data: { market_id: marketId, old_price: oldPrice, new_price: newPrice, change: percentChange },
    sendEmail: false,
  });
}

// Suggestion comment notifications
export async function notifySuggestionCommentMention(
  userId: string,
  mentionedByName: string,
  suggestionId: string,
  suggestionTitle: string,
  commentPreview: string
) {
  return createNotification({
    userId,
    type: 'SUGGESTION_COMMENT_MENTION',
    title: `${mentionedByName} mencionou você`,
    message: `Em sugestão "${suggestionTitle}": "${commentPreview}..."`,
    data: { suggestion_id: suggestionId, mentioned_by: mentionedByName },
    sendEmail: true,
  });
}

export async function notifySuggestionCommentReply(
  userId: string,
  repliedByName: string,
  suggestionId: string,
  suggestionTitle: string,
  replyPreview: string
) {
  return createNotification({
    userId,
    type: 'SUGGESTION_COMMENT_REPLY',
    title: `${repliedByName} respondeu ao seu comentário`,
    message: `Em sugestão "${suggestionTitle}": "${replyPreview}..."`,
    data: { suggestion_id: suggestionId, replied_by: repliedByName },
    sendEmail: false,
  });
}

// User warning notification
const reasonLabels: Record<string, string> = {
  spam: 'spam',
  offensive: 'conteúdo ofensivo',
  misinformation: 'desinformação',
  other: 'violação das diretrizes',
};

export async function notifyUserWarning(
  userId: string,
  reason: string,
  commentPreview: string,
  context: 'market' | 'suggestion'
) {
  const reasonLabel = reasonLabels[reason] || 'violação das diretrizes';
  const contextLabel = context === 'market' ? 'um mercado' : 'uma sugestão';
  
  return createNotification({
    userId,
    type: 'USER_WARNING',
    title: 'Advertência Recebida ⚠️',
    message: `Seu comentário em ${contextLabel} foi reportado por ${reasonLabel}. Por favor, revise as diretrizes da comunidade.`,
    data: { 
      reason, 
      reason_label: reasonLabel,
      context,
      comment_preview: commentPreview,
    },
    sendEmail: true,
  });
}

// Support notifications
export async function notifySupportReply(
  userId: string,
  ticketId: string,
  ticketSubject: string,
  messagePreview: string
) {
  return createNotification({
    userId,
    type: 'SUPPORT_REPLY',
    title: 'Nova Resposta no Suporte 📩',
    message: `Nossa equipe respondeu ao seu ticket "${ticketSubject}".`,
    data: { ticket_id: ticketId, subject: ticketSubject, message_preview: messagePreview },
    sendEmail: true,
  });
}

export async function notifySupportResolved(
  userId: string,
  ticketId: string,
  ticketSubject: string,
  status: 'resolved' | 'closed'
) {
  const statusLabel = status === 'resolved' ? 'resolvido' : 'fechado';
  return createNotification({
    userId,
    type: 'SUPPORT_TICKET_RESOLVED',
    title: 'Ticket Resolvido ✅',
    message: `Seu ticket "${ticketSubject}" foi marcado como ${statusLabel}.`,
    data: { ticket_id: ticketId, subject: ticketSubject, status },
    sendEmail: true,
  });
}
