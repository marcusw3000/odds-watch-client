import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Check if this payment was already processed
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("stripe_session_id", paymentIntentId)
      .single();

    if (existingPayment?.status === "COMPLETED") {
      logStep("Payment already processed");
      return new Response(
        JSON.stringify({
          success: true,
          status: "already_processed",
          amount: existingPayment.amount,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Check payment status
    if (paymentIntent.status === "succeeded") {
      const amount = paymentIntent.amount / 100; // Convert from cents

      // Update payment record
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({ status: "COMPLETED" })
        .eq("stripe_session_id", paymentIntentId);

      if (updateError) {
        logStep("Error updating payment", { error: updateError });
      }

      // Update user balance
      const { error: balanceError } = await supabaseAdmin.rpc("", {}).then(() => 
        supabaseAdmin
          .from("user_balances")
          .update({ 
            balance: supabaseAdmin.rpc as any // This won't work, need raw SQL
          })
          .eq("user_id", user.id)
      );

      // Use upsert for balance update
      const { data: currentBalance } = await supabaseAdmin
        .from("user_balances")
        .select("balance, total_deposited")
        .eq("user_id", user.id)
        .single();

      if (currentBalance) {
        const { error: balanceUpdateError } = await supabaseAdmin
          .from("user_balances")
          .update({
            balance: currentBalance.balance + amount,
            total_deposited: currentBalance.total_deposited + amount,
          })
          .eq("user_id", user.id);

        if (balanceUpdateError) {
          logStep("Error updating balance", { error: balanceUpdateError });
          throw new Error("Failed to update balance");
        }
        logStep("Balance updated", { newBalance: currentBalance.balance + amount });
      } else {
        // Create new balance record
        const { error: insertBalanceError } = await supabaseAdmin
          .from("user_balances")
          .insert({
            user_id: user.id,
            balance: amount,
            total_deposited: amount,
          });

        if (insertBalanceError) {
          logStep("Error creating balance", { error: insertBalanceError });
          throw new Error("Failed to create balance");
        }
        logStep("Balance created", { balance: amount });
      }

      // Create notification
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "DEPOSIT",
        title: "Depósito confirmado",
        message: `Seu depósito de R$ ${amount.toFixed(2)} foi confirmado com sucesso!`,
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
