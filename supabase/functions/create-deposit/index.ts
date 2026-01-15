import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DEPOSIT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { amount } = await req.json();
    if (!amount || amount < 10) {
      throw new Error("Valor mínimo de depósito é R$10,00");
    }
    if (amount > 10000) {
      throw new Error("Valor máximo de depósito é R$10.000,00");
    }
    logStep("Amount validated", { amount });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Create checkout session with PIX and card
    const origin = req.headers.get("origin") || "https://predictmarket.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["pix", "card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Depósito PredictMarket",
              description: `Depósito de R$${amount.toFixed(2)} na sua conta`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/portfolio?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portfolio?deposit=cancelled`,
      metadata: {
        user_id: user.id,
        type: "deposit",
        amount: amount.toString(),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          type: "deposit",
        },
      },
    });
    logStep("Checkout session created", { sessionId: session.id });

    // Create payment record in database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: user.id,
        type: "DEPOSIT",
        method: "CARD",
        amount: amount,
        fee: 0,
        net_amount: amount,
        status: "PENDING",
        stripe_checkout_session_id: session.id,
      });

    if (paymentError) {
      logStep("Error creating payment record", { error: paymentError });
    } else {
      logStep("Payment record created");
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
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
