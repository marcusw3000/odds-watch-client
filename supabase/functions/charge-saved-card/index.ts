import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHARGE-SAVED-CARD] ${step}${detailsStr}`);
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
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { amount, paymentMethodId } = await req.json();
    logStep("Request body", { amount, paymentMethodId });

    if (!amount || amount < 10) {
      throw new Error("Valor mínimo de depósito é R$ 10,00");
    }

    if (amount > 10000) {
      throw new Error("Valor máximo de depósito é R$ 10.000,00");
    }

    if (!paymentMethodId) {
      throw new Error("Método de pagamento não especificado");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe key not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer
    if (!user.email) {
      throw new Error("User email not available");
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      throw new Error("Nenhum cliente encontrado");
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Create PaymentIntent with the saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'brl',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        user_id: user.id,
        method: 'CARD',
        type: 'deposit',
        saved_card: 'true',
      },
    });

    logStep("PaymentIntent created and confirmed", { 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status
    });

    // Create payment record
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const status = paymentIntent.status === 'succeeded' ? 'COMPLETED' : 'PROCESSING';

    const { error: insertError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: user.id,
        type: "DEPOSIT",
        method: "CARD",
        amount: amount,
        fee: 0,
        net_amount: amount,
        status: status,
        stripe_payment_intent_id: paymentIntent.id,
        completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
      });

    if (insertError) {
      logStep("Error inserting payment record", { error: insertError });
    }

    // Update wallet balance if payment succeeded
    if (paymentIntent.status === 'succeeded') {
      const { error: depositError } = await supabaseAdmin
        .rpc('atomic_deposit_balance', {
          p_user_id: user.id,
          p_amount: amount
        });

      if (depositError) {
        logStep("Error with atomic deposit", { error: depositError });
        throw new Error("Failed to update balance");
      }

      logStep("Balance updated atomically", { amount });
    }

    return new Response(
      JSON.stringify({
        success: paymentIntent.status === 'succeeded',
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id,
        amount: amount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Check if it's a card error that requires authentication
    if (error instanceof Error && error.message.includes('authentication_required')) {
      return new Response(
        JSON.stringify({ 
          error: 'Autenticação adicional necessária. Por favor, use um novo cartão.',
          requiresAuth: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
