import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Market {
  id: string;
  title: string;
  status: string;
  close_date: string | null;
  settlement_type: string;
  settlement_config: Record<string, unknown> | null;
  settlement_date: string | null;
  result: string | null;
  market_type: string;
}

interface ProcessingResult {
  marketId: string;
  title: string;
  action: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();
  const results: ProcessingResult[] = [];

  try {
    // Verify service role authorization - only internal/cron calls allowed
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      console.error("[auto-expire-markets] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const now = new Date().toISOString();
    console.log(`[auto-expire-markets] Starting at ${now}`);

    // ========== PHASE 1: Expire OPEN markets past close_date ==========
    console.log("[auto-expire-markets] Phase 1: Checking expired OPEN markets...");

    const { data: expiredOpenMarkets, error: expiredError } = await supabase
      .from("markets")
      .select("*")
      .eq("status", "OPEN")
      .not("close_date", "is", null)
      .lt("close_date", now);

    if (expiredError) {
      console.error("[auto-expire-markets] Error fetching expired markets:", expiredError);
      throw expiredError;
    }

    console.log(`[auto-expire-markets] Found ${expiredOpenMarkets?.length || 0} expired OPEN markets`);

    for (const market of (expiredOpenMarkets || []) as Market[]) {
      try {
        console.log(`[auto-expire-markets] Processing expired market: ${market.title} (${market.id})`);

        if (market.settlement_type !== "MANUAL") {
          // Economic market - try to fetch BCB data and set result
          console.log(`[auto-expire-markets] Economic market (${market.settlement_type}), fetching BCB data...`);

          const bcbResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/bcb-data-fetcher`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({ indicator: market.settlement_type }),
            }
          );

          if (bcbResponse.ok) {
            const bcbData = await bcbResponse.json();
            console.log(`[auto-expire-markets] BCB data received:`, bcbData);

            // Evaluate condition based on settlement_config
            const config = market.settlement_config as { threshold?: number; operator?: string } | null;
            let result: string | null = null;

            if (config?.threshold !== undefined && config?.operator) {
              const value = bcbData.value;
              const threshold = config.threshold;

              switch (config.operator) {
                case "lt": result = value < threshold ? "YES" : "NO"; break;
                case "gt": result = value > threshold ? "YES" : "NO"; break;
                case "lte": result = value <= threshold ? "YES" : "NO"; break;
                case "gte": result = value >= threshold ? "YES" : "NO"; break;
                case "eq": result = value === threshold ? "YES" : "NO"; break;
              }

              console.log(`[auto-expire-markets] Condition: ${value} ${config.operator} ${threshold} = ${result}`);
            }

            // Move to CONTESTED with result and 48h contestation period
            const settlementDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

            const { error: updateError } = await supabase
              .from("markets")
              .update({
                status: "CONTESTED",
                result: result,
                result_source: `BCB API - ${market.settlement_type}: ${bcbData.value}`,
                settlement_date: settlementDate,
                updated_at: now,
              })
              .eq("id", market.id);

            if (updateError) {
              throw updateError;
            }

            // Record in market_settlements
            await supabase.from("market_settlements").insert({
              market_id: market.id,
              result: result,
              source: `BCB API - ${market.settlement_type}`,
              api_value: bcbData.value,
              api_response: bcbData,
              is_automatic: true,
            });

            results.push({
              marketId: market.id,
              title: market.title,
              action: `OPEN → CONTESTED (result: ${result}, BCB value: ${bcbData.value})`,
              success: true,
            });
          } else {
            // BCB API failed - move to PENDING for manual review
            console.error(`[auto-expire-markets] BCB API failed for ${market.id}`);

            await supabase
              .from("markets")
              .update({
                status: "PENDING",
                updated_at: now,
              })
              .eq("id", market.id);

            results.push({
              marketId: market.id,
              title: market.title,
              action: "OPEN → PENDING (BCB API failed)",
              success: true,
            });
          }
        } else {
          // Manual settlement - just move to PENDING
          const { error: updateError } = await supabase
            .from("markets")
            .update({
              status: "PENDING",
              updated_at: now,
            })
            .eq("id", market.id);

          if (updateError) {
            throw updateError;
          }

          results.push({
            marketId: market.id,
            title: market.title,
            action: "OPEN → PENDING (manual settlement required)",
            success: true,
          });
        }
      } catch (marketError) {
        console.error(`[auto-expire-markets] Error processing market ${market.id}:`, marketError);
        results.push({
          marketId: market.id,
          title: market.title,
          action: "Error during expiration",
          success: false,
          error: marketError instanceof Error ? marketError.message : String(marketError),
        });
      }
    }

    // ========== PHASE 2: Settle CONTESTED markets past 48h ==========
    console.log("[auto-expire-markets] Phase 2: Checking CONTESTED markets ready for settlement...");

    const { data: contestedMarkets, error: contestedError } = await supabase
      .from("markets")
      .select("*")
      .eq("status", "CONTESTED")
      .not("settlement_date", "is", null)
      .lt("settlement_date", now);

    if (contestedError) {
      console.error("[auto-expire-markets] Error fetching contested markets:", contestedError);
      throw contestedError;
    }

    console.log(`[auto-expire-markets] Found ${contestedMarkets?.length || 0} CONTESTED markets past 48h`);

    for (const market of (contestedMarkets || []) as Market[]) {
      try {
        console.log(`[auto-expire-markets] Processing contested market: ${market.title} (${market.id})`);

        // Check for approved contestations
        const { data: approvedContestations, error: contestationError } = await supabase
          .from("contestations")
          .select("id")
          .eq("market_id", market.id)
          .eq("status", "APPROVED")
          .limit(1);

        if (contestationError) {
          throw contestationError;
        }

        if (approvedContestations && approvedContestations.length > 0) {
          // There's an approved contestation - market result was reversed
          // Skip automatic settlement, admin will handle
          console.log(`[auto-expire-markets] Market ${market.id} has approved contestation, skipping`);
          results.push({
            marketId: market.id,
            title: market.title,
            action: "SKIPPED - has approved contestation (admin will handle)",
            success: true,
          });
          continue;
        }

        if (!market.result) {
          console.log(`[auto-expire-markets] Market ${market.id} has no result set, skipping`);
          results.push({
            marketId: market.id,
            title: market.title,
            action: "SKIPPED - no result set",
            success: false,
            error: "No result defined for market",
          });
          continue;
        }

        // Process payouts using the RPC function
        console.log(`[auto-expire-markets] Processing payouts for market ${market.id} with result ${market.result}`);

        const { data: payoutResult, error: payoutError } = await supabase.rpc(
          "process_market_payouts",
          { p_market_id: market.id, p_winning_outcome: market.result }
        );

        if (payoutError) {
          console.error(`[auto-expire-markets] Payout error for ${market.id}:`, payoutError);
          // Continue anyway to update status - payout error is non-fatal for status update
        } else {
          console.log(`[auto-expire-markets] Payout result for ${market.id}:`, payoutResult);
        }

        // Process copy trade commissions
        const { error: commissionError } = await supabase.rpc(
          "process_copy_trade_commissions",
          { p_market_id: market.id, p_winning_outcome: market.result }
        );

        if (commissionError) {
          console.error(`[auto-expire-markets] Commission error for ${market.id}:`, commissionError);
        }

        // Process achievements
        const { error: achievementError } = await supabase.rpc(
          "process_market_settlement_achievements",
          { p_market_id: market.id, p_winning_outcome: market.result }
        );

        if (achievementError) {
          console.error(`[auto-expire-markets] Achievement error for ${market.id}:`, achievementError);
        }

        // Update market status to SETTLED
        const { error: updateError } = await supabase
          .from("markets")
          .update({
            status: "SETTLED",
            updated_at: now,
          })
          .eq("id", market.id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          marketId: market.id,
          title: market.title,
          action: `CONTESTED → SETTLED (result: ${market.result}, payouts processed)`,
          success: true,
        });
      } catch (marketError) {
        console.error(`[auto-expire-markets] Error settling market ${market.id}:`, marketError);
        results.push({
          marketId: market.id,
          title: market.title,
          action: "Error during settlement",
          success: false,
          error: marketError instanceof Error ? marketError.message : String(marketError),
        });
      }
    }

    const duration = performance.now() - startTime;
    const summary = {
      timestamp: now,
      duration_ms: Math.round(duration),
      total_processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };

    console.log(`[auto-expire-markets] Completed in ${duration.toFixed(0)}ms:`, summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[auto-expire-markets] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
