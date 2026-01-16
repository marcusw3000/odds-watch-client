import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { decryptSensitiveData, maskPixKey } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-WITHDRAWAL] ${step}${detailsStr}`);
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
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user is admin
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!userRole) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("Admin verified", { userId: user.id });

    const { payment_id, action, error_message } = await req.json();

    if (!payment_id || !action) {
      throw new Error("payment_id and action are required");
    }

    if (!["COMPLETED", "FAILED"].includes(action)) {
      throw new Error("Invalid action. Must be COMPLETED or FAILED");
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .eq("type", "WITHDRAWAL")
      .eq("status", "PENDING")
      .single();

    if (paymentError || !payment) {
      throw new Error("Withdrawal not found or already processed");
    }
    logStep("Payment found", { paymentId: payment.id, amount: payment.amount });

    // Decrypt PIX key for admin viewing if needed
    const decryptedPixKey = payment.pix_key ? await decryptSensitiveData(payment.pix_key) : null;
    const maskedPixKey = decryptedPixKey ? maskPixKey(decryptedPixKey) : "****";

    if (action === "COMPLETED") {
      // Mark as completed
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
        })
        .eq("id", payment_id);

      if (updateError) throw new Error("Failed to update payment status");

      // Update wallet total_withdrawn
      await supabaseAdmin
        .from("wallets")
        .update({
          total_withdrawn: supabaseAdmin.rpc('get_wallet_withdrawn', { p_user_id: payment.user_id }),
        })
        .eq("user_id", payment.user_id);

      // Create notification with new type
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: payment.user_id,
          type: "WITHDRAWAL_COMPLETED",
          title: "Saque Concluído! ✅",
          message: `Seu saque de R$${payment.net_amount.toFixed(2)} foi processado com sucesso.`,
          data: { payment_id, amount: payment.amount, net_amount: payment.net_amount },
        });

      // Send completion email
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            user_id: payment.user_id,
            type: "WITHDRAWAL_COMPLETED",
            title: "Saque Concluído!",
            message: `Seu saque de R$${payment.net_amount.toFixed(2)} foi processado.`,
            data: {
              amount: payment.amount,
              fee: payment.fee,
              net_amount: payment.net_amount,
              pix_key_masked: maskedPixKey, // Use masked version in emails
              pix_key_type: payment.pix_key_type,
            },
          }),
        });
        logStep("Completion email sent");
      } catch (emailError) {
        logStep("Email send error (non-blocking)", { error: String(emailError) });
      }

      logStep("Withdrawal completed", { paymentId: payment_id });

    } else if (action === "FAILED") {
      // Mark as failed
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "FAILED",
          error_message: error_message || "Falha no processamento do saque",
        })
        .eq("id", payment_id);

      if (updateError) throw new Error("Failed to update payment status");

      // Refund the balance
      const { error: refundError } = await supabaseAdmin
        .rpc('atomic_deposit_balance', {
          p_user_id: payment.user_id,
          p_amount: payment.amount
        });

      if (refundError) {
        logStep("Refund error", { error: refundError.message });
      }
      logStep("Balance refunded", { amount: payment.amount });

      // Create notification with new type
      await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: payment.user_id,
          type: "WITHDRAWAL_FAILED",
          title: "Problema com seu Saque",
          message: error_message || "Não foi possível processar seu saque. O valor foi estornado.",
          data: { payment_id, amount: payment.amount, error_message },
        });

      // Send failure email
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            user_id: payment.user_id,
            type: "WITHDRAWAL_FAILED",
            title: "Problema com seu Saque",
            message: error_message || "Não foi possível processar seu saque.",
            data: {
              amount: payment.amount,
              error_message: error_message,
            },
          }),
        });
        logStep("Failure email sent");
      } catch (emailError) {
        logStep("Email send error (non-blocking)", { error: String(emailError) });
      }

      logStep("Withdrawal failed and refunded", { paymentId: payment_id });
    }

    // Log admin action
    await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        actor_user_id: user.id,
        action: `WITHDRAWAL_${action}`,
        entity: "payments",
        entity_id: payment_id,
        before_data: { status: "PENDING" },
        after_data: { status: action, error_message },
      });

    return new Response(JSON.stringify({ 
      success: true,
      payment_id,
      action,
      message: action === "COMPLETED" 
        ? "Saque processado com sucesso" 
        : "Saque rejeitado e valor estornado"
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
