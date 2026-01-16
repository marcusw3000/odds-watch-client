import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-INTENT] ${step}${detailsStr}`);
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

    const { amount, method, saveCard } = await req.json();
    logStep("Request body", { amount, method, saveCard });

    if (!amount || amount < 10) {
      throw new Error("Valor mínimo de depósito é R$ 10,00");
    }

    if (amount > 10000) {
      throw new Error("Valor máximo de depósito é R$ 10.000,00");
    }

    const validMethods = ['PIX', 'CARD'];
    if (!method || !validMethods.includes(method)) {
      throw new Error("Método de pagamento inválido");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe key not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    let customerId: string | undefined;
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing customer", { customerId });
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        logStep("Created new customer", { customerId });
      }
    }

    // Define payment method types based on selection
    const paymentMethodTypes = method === 'PIX' ? ['pix'] : ['card'];

    // Create PaymentIntent with setup_future_usage if saving card
    const paymentIntentOptions: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'brl',
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      metadata: {
        user_id: user.id,
        method: method,
        type: 'deposit',
      },
    };

    // Add setup_future_usage to save the card for future payments
    if (saveCard && method === 'CARD') {
      paymentIntentOptions.setup_future_usage = 'off_session';
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    logStep("PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ? 'present' : 'missing'
    });

    // Create pending payment record in database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: insertError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: user.id,
        type: "DEPOSIT",
        method: method,
        amount: amount,
        fee: 0,
        net_amount: amount,
        status: "PENDING",
        stripe_payment_intent_id: paymentIntent.id,
      });

    if (insertError) {
      logStep("Error inserting payment record", { error: insertError });
      // Don't fail the request, just log the error
    } else {
      logStep("Payment record created");
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
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
