import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify service role authorization - only internal/cron calls allowed
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar todas as transações agrupadas por dia
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("created_at, total_amount")
      .order("created_at", { ascending: true });

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    // Agrupar por dia
    const dailyData: Record<string, { volume: number; trades: number }> = {};
    
    for (const tx of transactions || []) {
      const date = tx.created_at.split("T")[0];
      if (!dailyData[date]) {
        dailyData[date] = { volume: 0, trades: 0 };
      }
      dailyData[date].volume += Number(tx.total_amount) || 0;
      dailyData[date].trades += 1;
    }

    // Ordenar datas e calcular volume acumulado
    const sortedDates = Object.keys(dailyData).sort();
    let cumulativeVolume = 0;
    let cumulativeTrades = 0;

    const snapshots = sortedDates.map((date) => {
      cumulativeVolume += dailyData[date].volume;
      cumulativeTrades += dailyData[date].trades;

      return {
        snapshot_date: date,
        total_platform_volume: cumulativeVolume,
        total_trades_count: cumulativeTrades,
        active_markets_count: 0, // Não temos histórico disso
        daily_volume: dailyData[date].volume,
        daily_trades_count: dailyData[date].trades,
      };
    });

    // 2. Buscar mercados ativos por data (aproximação: pegar count atual para a última data)
    if (snapshots.length > 0) {
      const { count: activeMarketsCount } = await supabase
        .from("markets")
        .select("*", { count: "exact", head: true })
        .eq("status", "OPEN");

      // Atualizar apenas o último snapshot com o count atual
      snapshots[snapshots.length - 1].active_markets_count = activeMarketsCount || 0;
    }

    // 3. Inserir snapshots (ignorar conflitos)
    let insertedCount = 0;
    let skippedCount = 0;

    for (const snapshot of snapshots) {
      const { error: insertError } = await supabase
        .from("daily_volume_snapshots")
        .upsert(snapshot, { onConflict: "snapshot_date", ignoreDuplicates: true });

      if (insertError) {
        console.warn(`Skipped ${snapshot.snapshot_date}: ${insertError.message}`);
        skippedCount++;
      } else {
        insertedCount++;
      }
    }

    console.log(`✅ Backfill complete: ${insertedCount} inserted, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill complete`,
        inserted: insertedCount,
        skipped: skippedCount,
        total_days: snapshots.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in backfill:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
