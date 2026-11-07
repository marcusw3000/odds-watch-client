import type { Notification } from "@/types/notification";

export function polymarketNotificationLink(notification: Pick<Notification, "data">): string | null {
  const data = notification.data;
  return data?.source === "polymarket" && typeof data.market_id === "string" && /^\d{1,20}$/.test(data.market_id)
    ? `/polymarket/market/${data.market_id}` : null;
}
