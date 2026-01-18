import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-COPY-SUBSCRIPTION] ${step}${detailsStr}`);
};

interface VerifyRequest {
  session_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const body: VerifyRequest = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = claimsData.claims.sub as string;
    logStep("User authenticated", { userId });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });

    logStep("Checkout session retrieved", { 
      sessionId: session.id, 
      status: session.status,
      paymentStatus: session.payment_status 
    });

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Payment not completed",
        status: session.payment_status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Extract metadata
    const traderId = session.metadata?.trader_id;
    const followerId = session.metadata?.follower_id;
    const autoCopy = session.metadata?.auto_copy === "true";
    const maxTradeAmount = session.metadata?.max_trade_amount ? parseFloat(session.metadata.max_trade_amount) : null;
    const copyPercentage = session.metadata?.copy_percentage ? parseFloat(session.metadata.copy_percentage) : 100;

    if (!traderId || followerId !== userId) {
      return new Response(JSON.stringify({ error: "Invalid session metadata" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Session metadata", { traderId, followerId, autoCopy });

    // Get subscription details
    const subscription = session.subscription as Stripe.Subscription;
    if (!subscription) {
      return new Response(JSON.stringify({ error: "No subscription found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check if subscription already exists
    const { data: existingSubscription } = await supabaseAdmin
      .from("copy_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (existingSubscription) {
      logStep("Subscription already exists", { subscriptionId: existingSubscription.id });
      return new Response(JSON.stringify({
        success: true,
        subscription_id: existingSubscription.id,
        already_exists: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get monthly fee from price
    const priceId = subscription.items.data[0]?.price?.id;
    let monthlyFee = 19.90;
    if (priceId) {
      const price = await stripe.prices.retrieve(priceId);
      monthlyFee = (price.unit_amount || 1990) / 100;
    }

    // Create copy subscription
    const { data: newSubscription, error: insertError } = await supabaseAdmin
      .from("copy_subscriptions")
      .insert({
        follower_id: userId,
        trader_id: traderId,
        status: "ACTIVE",
        auto_copy: autoCopy,
        max_trade_amount: maxTradeAmount,
        copy_percentage: copyPercentage,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: session.customer as string,
        payment_method: "STRIPE",
        monthly_fee_paid: monthlyFee,
        last_payment_at: new Date().toISOString(),
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logStep("Failed to create subscription", { error: insertError.message });
      return new Response(JSON.stringify({ error: insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Update trader follower count
    await supabaseAdmin.rpc("increment_trader_followers", { trader_id: traderId });

    logStep("Subscription created successfully", { subscriptionId: newSubscription.id });

    return new Response(JSON.stringify({
      success: true,
      subscription_id: newSubscription.id,
      period_end: newSubscription.current_period_end,
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
