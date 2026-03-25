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

    // 1. Get all markets
    const { data: markets, error: marketsError } = await supabase
      .from("markets")
      .select("id, current_yes_price, current_no_price, created_at")
      .order("created_at", { ascending: true });

    if (marketsError) {
      throw new Error(`Failed to fetch markets: ${marketsError.message}`);
    }

    let totalInserted = 0;
    let marketsProcessed = 0;

    for (const market of markets || []) {
      // Check if this market already has price history
      const { count: existingCount } = await supabase
        .from("market_price_history")
        .select("*", { count: "exact", head: true })
        .eq("market_id", market.id);

      if (existingCount && existingCount > 0) {
        console.log(`Market ${market.id} already has ${existingCount} price history records, skipping`);
        continue;
      }

      // 2. Get all transactions for this market
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("market_id, price_per_share, position, created_at, type")
        .eq("market_id", market.id)
        .in("type", ["BUY", "SELL"])
        .order("created_at", { ascending: true });

      if (txError) {
        console.error(`Failed to fetch transactions for market ${market.id}: ${txError.message}`);
        continue;
      }

      const historyRecords: Array<{
        market_id: string;
        yes_price: number;
        no_price: number;
        recorded_at: string;
        source: string;
      }> = [];

      // Insert initial price (50/50 at creation time)
      historyRecords.push({
        market_id: market.id,
        yes_price: 0.5,
        no_price: 0.5,
        recorded_at: market.created_at,
        source: "backfill_initial",
      });

      // For each transaction, derive the YES/NO prices at that time
      // Since we have price_per_share for each position, we can use it
      for (const tx of transactions || []) {
        const pricePerShare = Number(tx.price_per_share);
        
        // Approximate: if position is YES, price_per_share is the YES price
        // if position is NO, price_per_share is the NO price
        let yesPrice: number;
        let noPrice: number;
        
        if (tx.position === "YES") {
          yesPrice = pricePerShare;
          noPrice = 1 - pricePerShare;
        } else if (tx.position === "NO") {
          noPrice = pricePerShare;
          yesPrice = 1 - pricePerShare;
        } else {
          // OPTION type - skip for binary history
          continue;
        }

        historyRecords.push({
          market_id: market.id,
          yes_price: Math.max(0.01, Math.min(0.99, yesPrice)),
          no_price: Math.max(0.01, Math.min(0.99, noPrice)),
          recorded_at: tx.created_at,
          source: "backfill_trade",
        });
      }

      // Insert current price as final point
      historyRecords.push({
        market_id: market.id,
        yes_price: market.current_yes_price,
        no_price: market.current_no_price,
        recorded_at: new Date().toISOString(),
        source: "backfill_current",
      });

      // Insert all records
      if (historyRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("market_price_history")
          .insert(historyRecords);

        if (insertError) {
          console.error(`Failed to insert history for market ${market.id}: ${insertError.message}`);
        } else {
          totalInserted += historyRecords.length;
          marketsProcessed++;
          console.log(`Inserted ${historyRecords.length} records for market ${market.id}`);
        }
      }
    }

    console.log(`✅ Backfill complete: ${totalInserted} records for ${marketsProcessed} markets`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backfill complete",
        markets_processed: marketsProcessed,
        total_records_inserted: totalInserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
