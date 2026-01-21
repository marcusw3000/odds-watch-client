import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CopyTradeRequest {
  trader_user_id: string;
  transaction_id: string;
  market_id: string;
  outcome: "YES" | "NO";
  original_amount: number;
  original_shares: number;
  price_per_share: number;
}

function logStep(step: string, details?: unknown) {
  console.log(`[COPY-TRADE] ${step}:`, details ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: CopyTradeRequest = await req.json();
    const { trader_user_id, transaction_id, market_id, outcome, original_amount, original_shares, price_per_share } = body;

    logStep("Starting copy trade process", { trader_user_id, market_id, outcome, original_amount });

    // Find the copy trader record for this user
    const { data: copyTrader, error: traderError } = await supabaseAdmin
      .from("copy_traders")
      .select("id, status")
      .eq("user_id", trader_user_id)
      .eq("status", "APPROVED")
      .single();

    if (traderError || !copyTrader) {
      logStep("User is not an approved copy trader", { trader_user_id });
      return new Response(
        JSON.stringify({ success: true, message: "Not a copy trader", copies: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Found copy trader", { trader_id: copyTrader.id });

    // Get all active subscriptions with auto_copy enabled
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("copy_subscriptions")
      .select("*")
      .eq("trader_id", copyTrader.id)
      .eq("status", "ACTIVE")
      .eq("auto_copy", true);

    if (subsError) {
      logStep("Error fetching subscriptions", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No active auto-copy subscriptions found");
      return new Response(
        JSON.stringify({ success: true, message: "No active subscriptions", copies: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(`Found ${subscriptions.length} active subscriptions`);

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      notified: 0,
    };

    for (const subscription of subscriptions) {
      const followerId = subscription.follower_id;
      const copyPercentage = subscription.copy_percentage || 100;
      const maxTradeAmount = subscription.max_trade_amount;

      logStep(`Processing subscription for follower`, { followerId, copyPercentage, maxTradeAmount });

      // Calculate the amount to copy
      let copyAmount = original_amount * (copyPercentage / 100);
      
      // Apply max trade amount limit
      if (maxTradeAmount && copyAmount > maxTradeAmount) {
        copyAmount = maxTradeAmount;
      }

      // Calculate shares based on the copied amount
      const copyShares = (copyAmount / original_amount) * original_shares;

      // Check follower's wallet balance
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("balance_available")
        .eq("user_id", followerId)
        .single();

      if (walletError || !wallet) {
        logStep("Follower wallet not found", { followerId });
        
        // Record as failed
        await supabaseAdmin.from("copied_trades").insert({
          subscription_id: subscription.id,
          original_transaction_id: transaction_id,
          market_id,
          outcome,
          original_amount,
          copied_amount: copyAmount,
          original_price: price_per_share,
          status: "FAILED",
          failure_reason: "Wallet not found",
        });
        
        results.failed++;
        continue;
      }

      // Check if follower has enough balance
      if (wallet.balance_available < copyAmount) {
        logStep("Follower has insufficient balance", { 
          followerId, 
          required: copyAmount, 
          available: wallet.balance_available 
        });

        // Record as skipped
        await supabaseAdmin.from("copied_trades").insert({
          subscription_id: subscription.id,
          original_transaction_id: transaction_id,
          market_id,
          outcome,
          original_amount,
          copied_amount: copyAmount,
          original_price: price_per_share,
          status: "SKIPPED",
          skip_reason: `Insufficient balance: ${wallet.balance_available.toFixed(2)} < ${copyAmount.toFixed(2)}`,
        });

        // Create notification for the follower
        await supabaseAdmin.from("notifications").insert({
          user_id: followerId,
          type: "TRADE_COPIED",
          title: "Copy Trade Ignorado",
          message: `Saldo insuficiente para copiar trade de ${copyAmount.toFixed(2)}. Saldo disponível: ${wallet.balance_available.toFixed(2)}`,
          data: {
            market_id,
            outcome,
            required_amount: copyAmount,
            available_balance: wallet.balance_available,
          },
        });

        results.skipped++;
        continue;
      }

      // Execute the copy trade using atomic function
      const { data: tradeResult, error: tradeError } = await supabaseAdmin.rpc(
        "atomic_execute_trade",
        {
          p_user_id: followerId,
          p_market_id: market_id,
          p_outcome: outcome,
          p_shares: copyShares,
          p_max_cost: copyAmount * 1.05, // 5% slippage tolerance
        }
      );

      if (tradeError || !tradeResult?.success) {
        const errorMessage = tradeResult?.error || tradeError?.message || "Unknown error";
        logStep("Copy trade execution failed", { followerId, error: errorMessage });

        await supabaseAdmin.from("copied_trades").insert({
          subscription_id: subscription.id,
          original_transaction_id: transaction_id,
          market_id,
          outcome,
          original_amount,
          copied_amount: copyAmount,
          original_price: price_per_share,
          status: "FAILED",
          failure_reason: errorMessage,
        });

        results.failed++;
        continue;
      }

      logStep("Copy trade executed successfully", { 
        followerId, 
        copied_amount: tradeResult.trade_cost,
        shares: tradeResult.shares 
      });

      // Record successful copy
      await supabaseAdmin.from("copied_trades").insert({
        subscription_id: subscription.id,
        original_transaction_id: transaction_id,
        copied_transaction_id: tradeResult.transaction_id,
        market_id,
        outcome,
        original_amount,
        copied_amount: tradeResult.trade_cost,
        original_price: price_per_share,
        copied_price: tradeResult.price_per_share,
        status: "EXECUTED",
        executed_at: new Date().toISOString(),
      });

      // Update subscription stats
      await supabaseAdmin
        .from("copy_subscriptions")
        .update({
          total_trades_copied: subscription.total_trades_copied + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      // Note: trader stats are updated after the loop to avoid race conditions

      // Create notification for the follower
      await supabaseAdmin.from("notifications").insert({
        user_id: followerId,
        type: "TRADE_COPIED",
        title: "Trade Copiado!",
        message: `Trade de ${tradeResult.trade_cost.toFixed(2)} copiado com sucesso. Posição: ${outcome}`,
        data: {
          market_id,
          outcome,
          amount: tradeResult.trade_cost,
          shares: tradeResult.shares,
        },
      });

      results.success++;
    }

    // Update trader's total_trades_copied count
    const { data: currentTrader } = await supabaseAdmin
      .from("copy_traders")
      .select("total_trades_copied")
      .eq("id", copyTrader.id)
      .single();

    await supabaseAdmin
      .from("copy_traders")
      .update({
        total_trades_copied: (currentTrader?.total_trades_copied || 0) + results.success,
        updated_at: new Date().toISOString(),
      })
      .eq("id", copyTrader.id);

    logStep("Copy trade process completed", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Copy trades processed",
        copies: results.success,
        skipped: results.skipped,
        failed: results.failed,
        notified: results.notified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Copy trade error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
