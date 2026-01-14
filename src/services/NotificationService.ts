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
        type,
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
