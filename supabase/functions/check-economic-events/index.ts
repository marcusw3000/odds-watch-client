import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SettlementConfig {
  threshold: number;
  operator: "lt" | "gt" | "lte" | "gte" | "eq";
}

interface Market {
  id: string;
  title: string;
  settlement_type: string;
  settlement_config: SettlementConfig;
  status: string;
  close_date: string;
}

// Evaluate condition
function evaluateCondition(value: number, config: SettlementConfig): boolean {
  const { threshold, operator } = config;
  
  switch (operator) {
    case "lt": return value < threshold;
    case "gt": return value > threshold;
    case "lte": return value <= threshold;
    case "gte": return value >= threshold;
    case "eq": return value === threshold;
    default: return false;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    console.log("Checking economic events for automatic settlement...");
    
    // Find markets that are PENDING and have automatic settlement
    const { data: pendingMarkets, error: fetchError } = await supabase
      .from("markets")
      .select("*")
      .eq("status", "PENDING")
      .neq("settlement_type", "MANUAL");
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!pendingMarkets || pendingMarkets.length === 0) {
      console.log("No pending automatic markets found");
      return new Response(
        JSON.stringify({ message: "No pending markets", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Found ${pendingMarkets.length} pending automatic markets`);
    
    const results: Array<{ marketId: string; result: string; value: number }> = [];
    
    for (const market of pendingMarkets as Market[]) {
      try {
        console.log(`Processing market: ${market.title} (${market.settlement_type})`);
        
        // Fetch BCB data for this indicator
        const bcbResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/bcb-data-fetcher`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ indicator: market.settlement_type }),
          }
        );
        
        if (!bcbResponse.ok) {
          console.error(`Failed to fetch BCB data for ${market.settlement_type}`);
          continue;
        }
        
        const bcbData = await bcbResponse.json();
        console.log(`BCB data for ${market.settlement_type}:`, bcbData);
        
        // Evaluate condition
        const config = market.settlement_config as SettlementConfig;
        if (!config || !config.threshold || !config.operator) {
          console.error(`Invalid settlement config for market ${market.id}`);
          continue;
        }
        
        const conditionMet = evaluateCondition(bcbData.value, config);
        const result = conditionMet ? "YES" : "NO";
        
        console.log(`Market ${market.id}: value=${bcbData.value}, threshold=${config.threshold}, operator=${config.operator}, result=${result}`);
        
        // Update market status to CONTESTED (awaiting contestation period)
        const { error: updateError } = await supabase
          .from("markets")
          .update({
            status: "CONTESTED",
            result: result,
            result_source: `BCB API - ${market.settlement_type}: ${bcbData.value}`,
            settlement_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h contestation
            updated_at: new Date().toISOString(),
          })
          .eq("id", market.id);
        
        if (updateError) {
          console.error(`Failed to update market ${market.id}:`, updateError);
          continue;
        }
        
        // Record settlement
        const { error: settlementError } = await supabase
          .from("market_settlements")
          .insert({
            market_id: market.id,
            result: result,
            source: `BCB API - ${market.settlement_type}`,
            api_value: bcbData.value,
            api_response: bcbData,
            is_automatic: true,
          });
        
        if (settlementError) {
          console.error(`Failed to record settlement for ${market.id}:`, settlementError);
        }
        
        results.push({
          marketId: market.id,
          result,
          value: bcbData.value,
        });
        
      } catch (marketError) {
        console.error(`Error processing market ${market.id}:`, marketError);
      }
    }
    
    console.log(`Processed ${results.length} markets`);
    
    return new Response(
      JSON.stringify({
        message: "Economic events check complete",
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error checking economic events:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
