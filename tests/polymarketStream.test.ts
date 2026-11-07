import { describe, expect, it } from "vitest";
import { parseMarketStreamMessage } from "../src/lib/polymarketStream";

describe("Polymarket stream parsing", () => {
  it("reads the best prices only for the subscribed asset", () => {
    const result = parseMarketStreamMessage(JSON.stringify({ event_type: "price_change", price_changes: [
      { asset_id: "other", best_bid: "0.9", best_ask: "0.91" },
      { asset_id: "token", best_bid: "0.41", best_ask: "0.43" },
    ] }), "token");
    expect(result).toEqual({ bestBid: "0.41", bestAsk: "0.43" });
  });

  it("uses positive book levels to determine the best bid and ask", () => {
    const result = parseMarketStreamMessage(JSON.stringify([{ event_type: "book", asset_id: "token", bids: [{ price: "0.3", size: "5" }, { price: "0.5", size: "0" }], asks: [{ price: "0.7", size: "1" }, { price: "0.6", size: "2" }] }]), "token");
    expect(result).toEqual({ bestBid: "0.3", bestAsk: "0.6" });
  });

  it("ignores malformed messages, invalid prices, and other assets", () => {
    expect(parseMarketStreamMessage("PONG", "token")).toBeNull();
    expect(parseMarketStreamMessage(JSON.stringify({ event_type: "last_trade_price", asset_id: "other", price: "0.5" }), "token")).toBeNull();
    expect(parseMarketStreamMessage(JSON.stringify({ event_type: "last_trade_price", asset_id: "token", price: "1.5" }), "token")).toBeNull();
  });
});
