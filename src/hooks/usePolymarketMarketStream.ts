import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router-dom";
import { parseMarketStreamMessage, type PolymarketLiveQuote } from "@/lib/polymarketStream";

const MARKET_STREAM_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const HEARTBEAT_MS = 10_000;
const MIN_REVALIDATE_MS = 30_000;

export type PolymarketStreamState = "idle" | "connecting" | "live" | "reconnecting" | "stale";

/** Keeps the SSR snapshot fresh without exposing credentials or order actions. */
export function usePolymarketMarketStream(assetId: string | null): { state: PolymarketStreamState; quote: PolymarketLiveQuote | null } {
  const { revalidate } = useRevalidator();
  const [streamState, setStreamState] = useState<PolymarketStreamState>(assetId ? "connecting" : "idle");
  const [quote, setQuote] = useState<PolymarketLiveQuote | null>(null);
  const lastRevalidation = useRef(0);

  useEffect(() => {
    setQuote(null);
    if (!assetId) { setStreamState("idle"); return; }
    let closed = false;
    let attempt = 0;
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const scheduleRetry = () => {
      if (closed) return;
      attempt += 1;
      setStreamState("reconnecting");
      retry = setTimeout(connect, Math.min(1_000 * 2 ** (attempt - 1), 30_000));
    };
    const refreshSnapshot = () => {
      if (Date.now() - lastRevalidation.current < MIN_REVALIDATE_MS) return;
      lastRevalidation.current = Date.now();
      revalidate();
    };
    const connect = () => {
      setStreamState(attempt ? "reconnecting" : "connecting");
      socket = new WebSocket(MARKET_STREAM_URL);
      socket.onopen = () => {
        attempt = 0;
        socket?.send(JSON.stringify({ assets_ids: [assetId], type: "market", custom_feature_enabled: true }));
        heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("PING"), HEARTBEAT_MS);
        setStreamState("live");
        refreshSnapshot();
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string" || event.data === "PONG") return;
        const update = parseMarketStreamMessage(event.data, assetId);
        if (!update) return;
        setQuote((previous) => ({
          assetId, bestBid: null, bestAsk: null, lastTradePrice: null,
          ...(previous?.assetId === assetId ? previous : {}),
          ...update, receivedAt: Date.now(),
        }));
        refreshSnapshot();
      };
      socket.onerror = () => setStreamState("stale");
      socket.onclose = () => { if (heartbeat) clearInterval(heartbeat); setQuote(null); scheduleRetry(); };
    };
    connect();
    return () => {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [assetId, revalidate]);
  return { state: streamState, quote: quote?.assetId === assetId ? quote : null };
}
