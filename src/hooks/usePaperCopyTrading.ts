import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CopyStrategy = { id: string; source_kind: "paper" | "polymarket"; source_id: string; source_name: string; mode: "automatic" | "manual"; total_limit: number; per_trade_limit: number; spent_usd: number; round_id: string; active: boolean; started_at: string; monitoring_error: string | null; last_success_at: string | null };
export type CopySignal = { id: string; strategy_id: string; question: string; outcome: string; side: "BUY" | "SELL"; status: "pending" | "approved" | "executed" | "rejected" | "skipped"; source_price: number; source_notional: number; sell_fraction: number | null; reason: string | null; created_at: string };
export type CopyPosition = { strategy_id: string; round_id: string; realized_usd: number };
export function usePaperCopyTrading() {
  const { user } = useAuth(); const client = useQueryClient(); const db = supabase as any;
  const key = ["paper-copy", user?.id];
  const query = useQuery({ queryKey: key, enabled: !!user, refetchInterval: 15_000, queryFn: async () => {
    const [strategies, signals, positions] = await Promise.all([db.from("paper_copy_strategies").select("*").order("created_at", { ascending: false }), db.from("paper_copy_signals").select("*").order("created_at", { ascending: false }).limit(100), db.from("paper_copy_positions").select("strategy_id,round_id,realized_usd")]);
    if (strategies.error || signals.error || positions.error) throw strategies.error ?? signals.error ?? positions.error;
    return { strategies: (strategies.data ?? []) as CopyStrategy[], signals: (signals.data ?? []) as CopySignal[], positions: (positions.data ?? []) as CopyPosition[] };
  }});
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ["paper-copy"] }), client.invalidateQueries({ queryKey: ["polymarket-paper"] }), client.invalidateQueries({ queryKey: ["paper-leaderboard"] }), client.invalidateQueries({ queryKey: ["my-paper-ranking"] }), client.invalidateQueries({ queryKey: ["notifications"] })]); };
  const save = useMutation({ mutationFn: async (input: { kind: string; source: string; name: string; mode: string; total: number; perTrade: number }) => { const r = await db.rpc("save_paper_copy_strategy", { p_kind: input.kind, p_source: input.source, p_name: input.name, p_mode: input.mode, p_total: input.total, p_per_trade: input.perTrade }); if (r.error) throw r.error; }, onSuccess: refresh });
  const setActive = useMutation({ mutationFn: async (input: { id: string; active: boolean }) => { const r = await db.rpc("set_paper_copy_active", { p_strategy: input.id, p_active: input.active }); if (r.error) throw r.error; }, onSuccess: refresh });
  const respond = useMutation({ mutationFn: async (input: { id: string; accept: boolean }) => { const r = await db.rpc("respond_paper_copy_signal", { p_signal: input.id, p_accept: input.accept }); if (r.error) throw r.error; }, onSuccess: refresh });
  return { ...query, save, setActive, respond };
}
