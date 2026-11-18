import type { Notification } from "@/types/notification";

export function operationalNotificationLink(notification: Pick<Notification, "type" | "data">): string | null {
  const key = notification.data?.alert_key;
  return notification.type === 'SYSTEM_ANNOUNCEMENT' && typeof key === 'string' && ['catalog_error', 'copy_lag', 'snapshot_attempt', 'cron_failure', 'http_failure', 'disk_usage'].includes(key) ? '/admin/system' : null;
}

export function polymarketNotificationLink(notification: Pick<Notification, "data">): string | null {
  const data = notification.data;
  return data?.source === "polymarket" && typeof data.market_id === "string" && /^\d{1,20}$/.test(data.market_id)
    ? `/polymarket/market/${data.market_id}` : null;
}
