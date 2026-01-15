import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-PIX-STATUS] ${step}${detailsStr}`);
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
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
    
    logStep("PaymentIntent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount 
    });

    // Extract PIX specific data if available
    let pixData = null;
    const latestCharge = paymentIntent.latest_charge;
    
    if (latestCharge && typeof latestCharge === 'object' && 'payment_method_details' in latestCharge) {
      const pmd = latestCharge.payment_method_details;
      if (pmd && 'pix' in pmd) {
        const pixDetails = pmd.pix as { expires_at?: number };
        pixData = {
          expiresAt: pixDetails?.expires_at ? new Date(pixDetails.expires_at * 1000).toISOString() : null,
        };
      }
    }

    // Check for next_action (contains QR code for PIX)
    let pixQrCode = null;
    let pixCopyPaste = null;
    let expiresAt = null;
    
    if (paymentIntent.next_action?.type === 'pix_display_qr_code') {
      const pixAction = paymentIntent.next_action.pix_display_qr_code;
      if (pixAction) {
        pixQrCode = pixAction.image_url_png || pixAction.image_url_svg || null;
        pixCopyPaste = pixAction.data || null;
        expiresAt = pixAction.expires_at ? new Date(pixAction.expires_at * 1000).toISOString() : null;
      }
    }

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If payment succeeded, update database
    if (paymentIntent.status === "succeeded") {
      const amount = paymentIntent.amount / 100;

      // Check if already processed
      const { data: existingPayment } = await supabaseAdmin
        .from("payments")
        .select("status")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .single();

      if (existingPayment?.status !== "COMPLETED") {
        // Update payment record
        await supabaseAdmin
          .from("payments")
          .update({ 
            status: "COMPLETED",
            completed_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntentId);

        // Use atomic deposit function to update wallet balance
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

        // Create notification
        await supabaseAdmin.from("notifications").insert({
          user_id: user.id,
          type: "TRADE_EXECUTED",
          title: "Depósito PIX confirmado",
          message: `Seu depósito de R$ ${amount.toFixed(2)} via PIX foi confirmado!`,
        });

        logStep("PIX payment processed successfully");
      }

      return new Response(
        JSON.stringify({
          status: "succeeded",
          amount: amount,
          message: "Pagamento confirmado!",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Return current status with PIX data
    return new Response(
      JSON.stringify({
        status: paymentIntent.status,
        pixQrCode,
        pixCopyPaste,
        expiresAt: expiresAt || pixData?.expiresAt,
        amount: paymentIntent.amount / 100,
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
