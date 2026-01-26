import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Data do snapshot (hoje)
    const today = new Date();
    const snapshotDate = today.toISOString().split("T")[0];
    
    // Início e fim do dia para queries
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Buscar volume total de todos os mercados
    const { data: volumeData, error: volumeError } = await supabase
      .from("markets")
      .select("total_volume");

    if (volumeError) {
      throw new Error(`Failed to fetch volume: ${volumeError.message}`);
    }

    const totalPlatformVolume = volumeData?.reduce(
      (sum, m) => sum + (Number(m.total_volume) || 0),
      0
    ) || 0;

    // 2. Contar mercados ativos (OPEN)
    const { count: activeMarketsCount, error: marketsError } = await supabase
      .from("markets")
      .select("*", { count: "exact", head: true })
      .eq("status", "OPEN");

    if (marketsError) {
      throw new Error(`Failed to count active markets: ${marketsError.message}`);
    }

    // 3. Buscar total de trades (all time)
    const { count: totalTradesCount, error: totalTradesError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true });

    if (totalTradesError) {
      throw new Error(`Failed to count total trades: ${totalTradesError.message}`);
    }

    // 4. Buscar trades do dia
    const { data: dailyTrades, error: dailyTradesError } = await supabase
      .from("transactions")
      .select("total_amount")
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    if (dailyTradesError) {
      throw new Error(`Failed to fetch daily trades: ${dailyTradesError.message}`);
    }

    const dailyTradesCount = dailyTrades?.length || 0;
    const dailyVolume = dailyTrades?.reduce(
      (sum, t) => sum + (Number(t.total_amount) || 0),
      0
    ) || 0;

    // 5. UPSERT na tabela de snapshots
    const { error: upsertError } = await supabase
      .from("daily_volume_snapshots")
      .upsert(
        {
          snapshot_date: snapshotDate,
          total_platform_volume: totalPlatformVolume,
          total_trades_count: totalTradesCount || 0,
          active_markets_count: activeMarketsCount || 0,
          daily_volume: dailyVolume,
          daily_trades_count: dailyTradesCount,
        },
        { onConflict: "snapshot_date" }
      );

    if (upsertError) {
      throw new Error(`Failed to upsert snapshot: ${upsertError.message}`);
    }

    console.log(`✅ Snapshot created for ${snapshotDate}:`, {
      totalPlatformVolume,
      totalTradesCount,
      activeMarketsCount,
      dailyVolume,
      dailyTradesCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        snapshot_date: snapshotDate,
        data: {
          total_platform_volume: totalPlatformVolume,
          total_trades_count: totalTradesCount,
          active_markets_count: activeMarketsCount,
          daily_volume: dailyVolume,
          daily_trades_count: dailyTradesCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error creating snapshot:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
