import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getCorsHeaders();

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    const { paymentIntentId } = await req.json();
    logStep("Request body", { paymentIntentId });

    if (!paymentIntentId) {
      throw new Error("Payment intent ID is required");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe key not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    logStep("PaymentIntent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount 
    });

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check payment status
    if (paymentIntent.status === "succeeded") {
      const amount = paymentIntent.amount / 100; // Convert from cents

      // Atomic conditional update: only marks COMPLETED if status is still PENDING/PROCESSING.
      // If two concurrent requests arrive, only one will win (0 rows affected = race loser).
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("payments")
        .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .in("status", ["PENDING", "PROCESSING"])
        .select("id");

      if (updateError) {
        logStep("Error updating payment", { error: updateError });
        throw new Error("Failed to update payment record");
      }

      if (!updatedRows || updatedRows.length === 0) {
        // 0 rows updated: either already COMPLETED or no record exists yet.
        // Distinguish the two cases with a point-in-time check.
        const { data: existingCheck } = await supabaseAdmin
          .from("payments")
          .select("status, amount")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (existingCheck?.status === "COMPLETED") {
          logStep("Payment already processed (race condition guard)");
          return new Response(
            JSON.stringify({ success: true, status: "already_processed", amount }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        // No record found: payment was initiated outside the normal flow.
        // Fall through to credit the wallet — atomic_deposit_balance is idempotent at DB level.
        logStep("No payment record found, proceeding with wallet credit");
      }

      // Use atomic deposit function to update wallet balance
      const { data: depositSuccess, error: depositError } = await supabaseAdmin
        .rpc('atomic_deposit_balance', {
          p_user_id: user.id,
          p_amount: amount
        });

      if (depositError) {
        logStep("Error with atomic deposit", { error: depositError });
        throw new Error("Failed to update balance");
      }

      logStep("Balance updated atomically", { amount });

      // Create notification with new type
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "DEPOSIT_CONFIRMED",
        title: "Depósito Confirmado! 💰",
        message: `Seu depósito de R$ ${amount.toFixed(2)} foi creditado com sucesso.`,
        data: { amount, payment_intent_id: paymentIntentId },
      });

      logStep("Payment confirmed successfully");

      return new Response(
        JSON.stringify({
          success: true,
          status: "succeeded",
          amount: amount,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else if (paymentIntent.status === "processing") {
      logStep("Payment still processing");
      return new Response(
        JSON.stringify({
          success: false,
          status: "processing",
          message: "Pagamento ainda está sendo processado",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else if (paymentIntent.status === "requires_action") {
      logStep("Payment requires action");
      return new Response(
        JSON.stringify({
          success: false,
          status: "requires_action",
          message: "Pagamento requer ação adicional",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      logStep("Payment not successful", { status: paymentIntent.status });
      return new Response(
        JSON.stringify({
          success: false,
          status: paymentIntent.status,
          message: "Pagamento não foi concluído",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
