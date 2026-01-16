import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encryptSensitiveData } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-DEPOSIT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { session_id } = await req.json();
    if (!session_id) throw new Error("Session ID is required");
    logStep("Session ID received", { session_id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep("Session retrieved", { status: session.payment_status, amount: session.amount_total });

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ 
        success: false, 
        status: session.payment_status,
        message: "Pagamento ainda não confirmado" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userId = session.metadata?.user_id;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    logStep("Payment confirmed", { userId, amount });

    // Encrypt session_id to match how it was stored
    const encryptedSessionId = await encryptSensitiveData(session_id);

    // Check if already processed
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("stripe_checkout_session_id", encryptedSessionId)
      .single();

    if (existingPayment?.status === "COMPLETED") {
      logStep("Payment already processed");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Depósito já foi creditado",
        amount 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Encrypt payment intent ID for storage
    const encryptedPaymentIntentId = session.payment_intent 
      ? await encryptSensitiveData(session.payment_intent as string)
      : null;

    // Update payment status
    await supabaseAdmin
      .from("payments")
      .update({ 
        status: "COMPLETED",
        stripe_payment_intent_id: encryptedPaymentIntentId,
        completed_at: new Date().toISOString(),
      })
      .eq("stripe_checkout_session_id", encryptedSessionId);

    // Use atomic deposit function to credit wallet balance
    const { error: depositError } = await supabaseAdmin
      .rpc('atomic_deposit_balance', {
        p_user_id: userId,
        p_amount: amount
      });

    if (depositError) {
      logStep("Error with atomic deposit", { error: depositError });
      throw new Error("Failed to update balance");
    }

    logStep("Balance updated atomically", { amount });

    // Create notification with new type
    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        type: "DEPOSIT_CONFIRMED",
        title: "Depósito Confirmado! 💰",
        message: `Seu depósito de R$${amount.toFixed(2)} foi creditado com sucesso.`,
        data: { amount, session_id },
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Depósito creditado com sucesso!",
      amount 
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
