import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const key = (userId?: string) => ["polymarket-paper", userId] as const;
export interface PaperTradeInput { marketId: string; outcome: string; side: "BUY" | "SELL"; shares: number; requestId: string; roundId: string; limitPrice: number }
export function usePolymarketPaperTrading({ enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth(); const client = useQueryClient();
  const query = useQuery({ queryKey: key(user?.id), enabled: Boolean(user) && enabled, queryFn: async () => {
    const db = supabase as any;
    const { data: wallet, error: walletError } = await db.rpc("get_polymarket_paper_wallet"); if (walletError) throw walletError;
    const [{ data: positions, error: positionsError }, { data: trades, error: tradesError }] = await Promise.all([
      db.from("polymarket_paper_positions").select("*").order("updated_at", { ascending: false }),
      db.from("polymarket_paper_trades").select("*").order("created_at", { ascending: false }).limit(10),
    ]); if (positionsError || tradesError) throw positionsError ?? tradesError; return { wallet, positions, trades };
  }});
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: key(user?.id) }), client.invalidateQueries({ queryKey: ["paper-portfolio-quotes"] }), client.invalidateQueries({ queryKey: ["paper-leaderboard"] }), client.invalidateQueries({ queryKey: ["my-paper-ranking"] }), client.invalidateQueries({ queryKey: ["paper-profile", user?.id] })]); };
  const trade = useMutation({ mutationFn: async (input: PaperTradeInput) => {
    const { data, error } = await supabase.functions.invoke("execute-polymarket-paper-trade", { body: input });
    if (error) {
      let message = "Não foi possível registrar a operação simulada.";
      if (error.context instanceof Response) { try { const payload = await error.context.clone().json(); if (typeof payload?.error === "string") message = payload.error; } catch { /* keep safe message */ } }
      throw new Error(message);
    }
    if (!data?.success) throw new Error(typeof data?.error === "string" ? data.error : "Operação simulada indisponível.");
    return data;
  }, onSuccess: refresh });
  const reset = useMutation({ mutationFn: async () => { const { error } = await (supabase as any).rpc("reset_polymarket_paper_wallet"); if (error) throw error; }, onSuccess: async () => { await refresh(); } });
  return { ...query, trade, reset, refresh, isAuthenticated: Boolean(user), userId: user?.id };
}
