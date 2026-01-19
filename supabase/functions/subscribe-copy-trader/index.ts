import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUBSCRIBE-COPY-TRADER] ${step}${detailsStr}`);
};

interface SubscribeRequest {
  trader_id: string;
  auto_copy?: boolean;
  max_trade_amount?: number;
  copy_percentage?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Parse request
    const body: SubscribeRequest = await req.json();
    const { trader_id, auto_copy = true, max_trade_amount, copy_percentage = 100 } = body;

    if (!trader_id) {
      return new Response(JSON.stringify({ error: "trader_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Request parsed", { trader_id });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      logStep("Authentication failed", { error: claimsError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = claimsData.claims.sub as string;
    logStep("User authenticated", { userId });

    // Fetch trader info
    const { data: trader, error: traderError } = await supabaseAdmin
      .from("copy_traders")
      .select("*")
      .eq("id", trader_id)
      .eq("status", "APPROVED")
      .single();

    if (traderError || !trader) {
      logStep("Trader not found or not approved", { trader_id, error: traderError?.message });
      return new Response(JSON.stringify({ error: "Trader not found or not approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Cannot subscribe to yourself
    if (trader.user_id === userId) {
      return new Response(JSON.stringify({ error: "Cannot subscribe to yourself" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Trader found", { trader_id: trader.id, display_name: trader.display_name });

    // Check for existing active subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from("copy_subscriptions")
      .select("id")
      .eq("follower_id", userId)
      .eq("trader_id", trader_id)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (existingSubscription) {
      return new Response(JSON.stringify({ error: "Already subscribed to this trader" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get copy trade settings for default fee
    const { data: settings } = await supabaseAdmin
      .from("copy_trade_settings")
      .select("*")
      .limit(1)
      .single();

    const monthlyFee = trader.monthly_fee ?? settings?.default_monthly_fee ?? 19.90;
    logStep("Monthly fee determined", { monthlyFee });

    // Process wallet payment
    logStep("Processing wallet payment");

    // Call atomic function
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("atomic_subscribe_copy_trader", {
      p_follower_id: userId,
      p_trader_id: trader_id,
      p_amount: monthlyFee,
      p_auto_copy: auto_copy,
      p_max_trade_amount: max_trade_amount,
      p_copy_percentage: copy_percentage,
    });

    if (rpcError) {
      logStep("Atomic function error", { error: rpcError.message });
      return new Response(JSON.stringify({ error: rpcError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!result.success) {
      logStep("Subscription failed", { error: result.error });
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error,
        required: result.required,
        available: result.available 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Wallet subscription successful", result);

    return new Response(JSON.stringify({
      success: true,
      subscription_id: result.subscription_id,
      period_end: result.period_end,
      amount_charged: result.amount_charged,
      new_balance: result.new_balance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
