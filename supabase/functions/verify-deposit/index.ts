import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    // Require JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Verify the user's JWT token
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      logStep("ERROR: Invalid JWT token", { error: claimsError?.message });
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const authenticatedUserId = claimsData.claims.sub;
    logStep("User authenticated", { userId: authenticatedUserId });

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

    // Verify the session belongs to the authenticated user
    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId !== authenticatedUserId) {
      logStep("ERROR: User ID mismatch", { sessionUserId, authenticatedUserId });
      return new Response(JSON.stringify({ error: "Unauthorized: session belongs to different user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    logStep("User authorization verified");

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

    const userId = sessionUserId;
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    logStep("Payment confirmed", { userId, amount });

    // Check if already processed
    // Note: Stripe IDs are stored as plain text - they are opaque tokens, not sensitive data
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("stripe_checkout_session_id", session_id)
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

    // Fetch active fee rule for DEPOSIT
    const { data: feeRule, error: feeRuleError } = await supabaseAdmin
      .from("fee_rules")
      .select("*")
      .eq("type", "DEPOSIT")
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (feeRuleError) {
      logStep("Fee rule fetch error (using default 0)", { error: feeRuleError.message });
    }

    // Calculate fee based on rule mode
    let feeAmount = 0;
    if (feeRule) {
      if (feeRule.mode === 'PERCENT') {
        feeAmount = amount * (feeRule.percent_value || 0);
      } else if (feeRule.mode === 'FIXED') {
        feeAmount = feeRule.flat_value || 0;
      }
      // Apply min/max constraints
      if (feeRule.min_fee !== null && feeAmount < feeRule.min_fee) {
        feeAmount = feeRule.min_fee;
      }
      if (feeRule.max_fee !== null && feeAmount > feeRule.max_fee) {
        feeAmount = feeRule.max_fee;
      }
      logStep("Fee calculated", { feeRuleId: feeRule.id, mode: feeRule.mode, feeAmount });
    }

    // Check for referral discount
    let discountApplied = 0;
    const { data: discount } = await supabaseAdmin.rpc(
      'get_active_referral_discount',
      { p_user_id: userId }
    );

    if (discount && discount.length > 0 && discount[0].has_discount) {
      const originalFee = feeAmount;
      feeAmount = feeAmount * (1 - discount[0].discount_percent);
      discountApplied = originalFee - feeAmount;
      logStep("Referral discount applied", { 
        originalFee, 
        discountPercent: discount[0].discount_percent,
        newFee: feeAmount,
        discountApplied
      });
    }

    feeAmount = Math.round(feeAmount * 100) / 100; // Round to 2 decimals
    const netAmount = amount - feeAmount;

    // Update payment status with fee info
    await supabaseAdmin
      .from("payments")
      .update({ 
        status: "COMPLETED",
        fee: feeAmount,
        net_amount: netAmount,
        stripe_payment_intent_id: session.payment_intent as string || null,
        completed_at: new Date().toISOString(),
      })
      .eq("stripe_checkout_session_id", session_id);

    // Use atomic deposit function to credit wallet balance (credit net amount after fee)
    const { error: depositError } = await supabaseAdmin
      .rpc('atomic_deposit_balance', {
        p_user_id: userId,
        p_amount: netAmount
      });

    if (depositError) {
      logStep("Error with atomic deposit", { error: depositError });
      throw new Error("Failed to update balance");
    }

    logStep("Balance updated atomically", { amount, feeAmount, netAmount, discountApplied });

    // Try to activate referral if this is first deposit >= min_deposit
    const { data: referralActivated } = await supabaseAdmin.rpc(
      'activate_referral_on_deposit',
      { p_user_id: userId, p_deposit_amount: amount }
    );

    if (referralActivated) {
      logStep("Referral activated for user", { userId });
    }

    // Process referral commission if there's a fee
    if (feeAmount > 0) {
      const { data: commissionResult } = await supabaseAdmin.rpc(
        'process_referral_commission',
        { p_referred_id: userId, p_fee_amount: feeAmount, p_trade_amount: amount }
      );

      if (commissionResult?.processed) {
        logStep("Referral commission processed", { 
          commissionAmount: commissionResult.commission_amount,
          referrerId: commissionResult.referrer_id 
        });
      }
    }

    // Record platform revenue if there's a fee
    if (feeAmount > 0) {
      const today = new Date().toISOString().split('T')[0];
      const { error: revenueError } = await supabaseAdmin
        .from("platform_revenue")
        .upsert({
          day: today,
          type: 'DEPOSIT',
          gross: amount,
          fees: feeAmount,
          net: netAmount
        }, {
          onConflict: 'day,type'
        });

      if (revenueError) {
        logStep("Error recording platform revenue", { error: revenueError });
      } else {
        logStep("Platform revenue recorded", { type: 'DEPOSIT', feeAmount });
      }
    }

    // Create notification with new type
    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        type: "DEPOSIT_CONFIRMED",
        title: "Depósito Confirmado! 💰",
        message: feeAmount > 0 
          ? `Seu depósito de R$${amount.toFixed(2)} foi creditado. Taxa: R$${feeAmount.toFixed(2)}. Valor líquido: R$${netAmount.toFixed(2)}.`
          : `Seu depósito de R$${amount.toFixed(2)} foi creditado com sucesso.`,
        data: { amount, fee: feeAmount, net_amount: netAmount, session_id },
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Depósito creditado com sucesso!",
      amount,
      fee: feeAmount,
      net_amount: netAmount
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
