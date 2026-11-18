import { describe, expect, it } from "vitest";
import { operationalNotificationLink, polymarketNotificationLink } from "../src/lib/notificationLinks";

describe("Polymarket notification links", () => {
  it("opens the corresponding external market", () => {
    expect(polymarketNotificationLink({ data: { source: "polymarket", market_id: "123" } })).toBe("/polymarket/market/123");
  });
  it("rejects other sources and invalid market IDs", () => {
    expect(polymarketNotificationLink({ data: { source: "other", market_id: "123" } })).toBeNull();
    expect(polymarketNotificationLink({ data: { source: "polymarket", market_id: "../profile" } })).toBeNull();
  });
});

describe('operational notification links', () => {
  it('links only recognized operational alerts to the admin panel', () => {
    expect(operationalNotificationLink({ type: 'SYSTEM_ANNOUNCEMENT', data: { alert_key: 'copy_lag', url: 'https://example.test' } })).toBe('/admin/system');
    expect(operationalNotificationLink({ type: 'SYSTEM_ANNOUNCEMENT', data: { alert_key: 'unknown', url: '/admin/system' } })).toBeNull();
    expect(operationalNotificationLink({ type: 'TRADE_EXECUTED', data: { alert_key: 'copy_lag' } })).toBeNull();
  });
});
