import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
  payment_method: 'STRIPE' | 'WALLET';
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
    const { trader_id, payment_method, auto_copy = true, max_trade_amount, copy_percentage = 100 } = body;

    if (!trader_id || !payment_method) {
      return new Response(JSON.stringify({ error: "trader_id and payment_method are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Request parsed", { trader_id, payment_method });

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

    // WALLET PAYMENT
    if (payment_method === "WALLET") {
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
        payment_method: "WALLET",
        subscription_id: result.subscription_id,
        period_end: result.period_end,
        amount_charged: result.amount_charged,
        new_balance: result.new_balance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // STRIPE PAYMENT
    logStep("Processing Stripe payment");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get user email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const userEmail = userData.user.email;
    logStep("User email found", { email: userEmail });

    // Check if customer exists in Stripe
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    }

    // Check if trader has a Stripe price configured
    let priceId = trader.stripe_price_id;

    if (!priceId) {
      // Create a price for this trader
      logStep("Creating Stripe product and price for trader");

      let productId = trader.stripe_product_id;

      if (!productId) {
        // Create product
        const product = await stripe.products.create({
          name: `Copy Trade: ${trader.display_name}`,
          description: `Assinatura para copiar trades de ${trader.display_name}`,
          metadata: {
            trader_id: trader.id,
            type: "copy_trade_subscription",
          },
        });
        productId = product.id;

        // Update trader with product ID
        await supabaseAdmin
          .from("copy_traders")
          .update({ stripe_product_id: productId })
          .eq("id", trader.id);

        logStep("Created Stripe product", { productId });
      }

      // Create price
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(monthlyFee * 100), // Convert to cents
        currency: "brl",
        recurring: { interval: "month" },
        metadata: {
          trader_id: trader.id,
        },
      });
      priceId = price.id;

      // Update trader with price ID
      await supabaseAdmin
        .from("copy_traders")
        .update({ stripe_price_id: priceId })
        .eq("id", trader.id);

      logStep("Created Stripe price", { priceId });
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "https://odds-watch-client.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/copy-traders?subscription=success&trader=${trader_id}`,
      cancel_url: `${origin}/copy-traders?subscription=cancelled`,
      metadata: {
        trader_id: trader.id,
        follower_id: userId,
        auto_copy: String(auto_copy),
        max_trade_amount: max_trade_amount ? String(max_trade_amount) : "",
        copy_percentage: String(copy_percentage),
      },
      subscription_data: {
        metadata: {
          trader_id: trader.id,
          follower_id: userId,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({
      success: true,
      payment_method: "STRIPE",
      checkout_url: session.url,
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
