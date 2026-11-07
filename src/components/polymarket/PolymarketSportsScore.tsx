import { useEffect, useState } from "react";

type Score = { score: string; period: string; live: boolean; ended: boolean };

export function PolymarketSportsScore({ slug }: { slug: string | null }) {
  const [result, setResult] = useState<Score | null>(null);
  useEffect(() => {
    if (!slug) return;
    let stopped = false;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      socket = new WebSocket("wss://sports-api.polymarket.com/ws");
      socket.onmessage = (message) => {
        if (message.data === "ping") { socket.send("pong"); return; }
        try {
          const value = JSON.parse(message.data);
          if (value.slug !== slug || typeof value.score !== "string") return;
          setResult({ score: value.score.slice(0, 40), period: typeof value.period === "string" ? value.period.slice(0, 40) : "", live: value.live === true, ended: value.ended === true });
        } catch { /* Ignore unrelated frames. */ }
      };
      socket.onclose = () => { if (!stopped) timer = setTimeout(connect, 5000); };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => { stopped = true; clearTimeout(timer); socket?.close(); };
  }, [slug]);
  if (!result) return null;
  return <p className="rounded-lg border border-border bg-card p-3 text-sm"><span className="font-semibold">{result.live ? "Ao vivo" : result.ended ? "Encerrado" : "Placar"}</span> · {result.score}{result.period && ` · ${result.period}`} <span className="text-muted-foreground">· Polymarket</span></p>;
}
