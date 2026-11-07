import { describe, expect, it } from "vitest";
import { polymarketNotificationLink } from "../src/lib/notificationLinks";

describe("Polymarket notification links", () => {
  it("opens the corresponding external market", () => {
    expect(polymarketNotificationLink({ data: { source: "polymarket", market_id: "123" } })).toBe("/polymarket/market/123");
  });
  it("rejects other sources and invalid market IDs", () => {
    expect(polymarketNotificationLink({ data: { source: "other", market_id: "123" } })).toBeNull();
    expect(polymarketNotificationLink({ data: { source: "polymarket", market_id: "../profile" } })).toBeNull();
  });
});
