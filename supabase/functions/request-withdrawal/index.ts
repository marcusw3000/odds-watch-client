import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encryptSensitiveData, maskPixKey } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REQUEST-WITHDRAWAL] ${step}${detailsStr}`);
};

// Generate idempotency key based on user, amount, pix_key, and rounded timestamp (30s window)
const generateIdempotencyKey = (userId: string, amount: number, pixKey: string): string => {
  const roundedTime = Math.floor(Date.now() / 30000); // 30 second windows
  const data = `${userId}:${amount}:${pixKey}:${roundedTime}`;
  // Simple hash for idempotency
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `wd_${userId.substring(0, 8)}_${Math.abs(hash).toString(36)}`;
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

    const { amount, pix_key, pix_key_type } = await req.json();
    
    // Validate amount
    if (!amount || amount < 20) {
      throw new Error("Valor mínimo de saque é R$20,00");
    }
    if (amount > 5000) {
      throw new Error("Valor máximo de saque é R$5.000,00");
    }

    // Validate PIX key
    if (!pix_key || !pix_key_type) {
      throw new Error("Chave PIX é obrigatória");
    }

    const validPixTypes = ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"];
    if (!validPixTypes.includes(pix_key_type)) {
      throw new Error("Tipo de chave PIX inválido");
    }

    // Validate PIX key format based on type
    const pixValidationRules: Record<string, RegExp> = {
      CPF: /^\d{11}$/,
      CNPJ: /^\d{14}$/,
      EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      PHONE: /^\+55\d{10,11}$/,
      RANDOM: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    };

    const pixPattern = pixValidationRules[pix_key_type];
    if (pixPattern && !pixPattern.test(pix_key)) {
      const errorMessages: Record<string, string> = {
        CPF: "CPF deve conter exatamente 11 dígitos",
        CNPJ: "CNPJ deve conter exatamente 14 dígitos",
        EMAIL: "Email inválido",
        PHONE: "Telefone deve estar no formato +55XXXXXXXXXXX",
        RANDOM: "Chave aleatória deve ser um UUID válido",
      };
      throw new Error(errorMessages[pix_key_type] || "Formato de chave PIX inválido");
    }
    logStep("PIX key validated", { pix_key_type, format: "valid" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(user.id, amount, pix_key);
    logStep("Idempotency key generated", { idempotencyKey });

    // Check if withdrawal with same idempotency key already exists (exact duplicate)
    const { data: existingWithKey, error: keyCheckError } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (keyCheckError) {
      logStep("Idempotency check error", { error: keyCheckError.message });
    }

    if (existingWithKey) {
      logStep("Duplicate withdrawal detected via idempotency key", { 
        existingId: existingWithKey.id, 
        status: existingWithKey.status 
      });
      throw new Error("Solicitação de saque já está sendo processada. Aguarde alguns instantes.");
    }

    // Note: Duplicate detection relies on idempotency_key mechanism above
    // The database-level check_pending_withdrawal function was removed because
    // it compared encrypted PIX keys (which use random IVs and never match)
    logStep("Duplicate check completed via idempotency key");

    // Rate limiting: max 3 withdrawal requests per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentAttempts, error: countError } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("type", "WITHDRAWAL")
      .gte("created_at", oneHourAgo);

    if (countError) {
      logStep("Rate limit check error", { error: countError.message });
      throw new Error("Erro ao verificar limite de requisições");
    }

    if ((recentAttempts ?? 0) >= 3) {
      logStep("Rate limit exceeded", { recentAttempts, userId: user.id });
      throw new Error("Limite de saques excedido. Aguarde 1 hora para tentar novamente.");
    }
    logStep("Rate limit check passed", { recentAttempts });

    // Use atomic withdrawal to prevent race conditions
    // This locks the row and checks/deducts balance atomically
    const { data: withdrawSuccess, error: withdrawError } = await supabaseAdmin
      .rpc('atomic_withdraw_balance', {
        p_user_id: user.id,
        p_amount: amount
      });

    if (withdrawError) {
      logStep("Atomic withdraw error", { error: withdrawError.message });
      throw new Error("Erro ao processar saque. Tente novamente.");
    }

    if (!withdrawSuccess) {
      throw new Error("Saldo insuficiente para este saque");
    }
    logStep("Balance atomically deducted", { amount });

    // Fetch active fee rule for WITHDRAW
    const { data: feeRule, error: feeRuleError } = await supabaseAdmin
      .from("fee_rules")
      .select("*")
      .eq("type", "WITHDRAW")
      .eq("is_active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (feeRuleError) {
      logStep("Fee rule fetch error (using default 0)", { error: feeRuleError.message });
    }

    // Calculate fee based on rule mode
    let fee = 0;
    if (feeRule) {
      if (feeRule.mode === 'PERCENT') {
        fee = amount * (feeRule.percent_value || 0);
      } else if (feeRule.mode === 'FIXED') {
        fee = feeRule.flat_value || 0;
      }
      // Apply min/max constraints
      if (feeRule.min_fee !== null && fee < feeRule.min_fee) {
        fee = feeRule.min_fee;
      }
      if (feeRule.max_fee !== null && fee > feeRule.max_fee) {
        fee = feeRule.max_fee;
      }
      logStep("Fee calculated", { feeRuleId: feeRule.id, mode: feeRule.mode, fee });
    }

    const netAmount = amount - fee;

    // Encrypt PIX key before storing
    const encryptedPixKey = await encryptSensitiveData(pix_key);
    logStep("PIX key encrypted for storage");

    // Create withdrawal request with idempotency key
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: user.id,
        type: "WITHDRAWAL",
        method: "PIX",
        amount: amount,
        fee: fee,
        net_amount: netAmount,
        status: "PENDING",
        pix_key: encryptedPixKey,
        pix_key_type: pix_key_type,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (paymentError) {
      // If insert fails due to unique constraint, it's a duplicate
      if (paymentError.code === '23505') {
        logStep("Duplicate insert prevented by unique constraint", { idempotencyKey });
        throw new Error("Solicitação de saque já está sendo processada.");
      }
      throw new Error("Erro ao criar solicitação de saque");
    }
    logStep("Withdrawal request created", { paymentId: payment.id, idempotencyKey, fee });
    // Note: Balance was already atomically deducted by atomic_withdraw_balance

    // Record platform revenue if there's a fee
    if (fee > 0) {
      const today = new Date().toISOString().split('T')[0];
      const { error: revenueError } = await supabaseAdmin
        .from("platform_revenue")
        .upsert({
          day: today,
          type: 'WITHDRAW',
          gross: amount,
          fees: fee,
          net: netAmount
        }, {
          onConflict: 'day,type'
        });

      if (revenueError) {
        logStep("Error recording platform revenue", { error: revenueError });
      } else {
        logStep("Platform revenue recorded", { type: 'WITHDRAW', fee });
      }
    }

    // Create notification with new type
    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: user.id,
        type: "WITHDRAWAL_REQUESTED",
        title: "Solicitação de Saque Recebida",
        message: `Seu saque de R$${netAmount.toFixed(2)} está sendo processado.`,
        data: { amount, fee, net_amount: netAmount, payment_id: payment.id },
      });

    // Send confirmation email
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          type: "WITHDRAWAL_REQUESTED",
          title: "Solicitação de Saque Recebida",
          message: `Seu saque de R$${netAmount.toFixed(2)} está sendo processado.`,
          data: {
            amount,
            fee,
            net_amount: netAmount,
            pix_key_masked: maskPixKey(pix_key), // Send masked version in emails
            pix_key_type: pix_key_type,
            payment_id: payment.id,
          },
        }),
      });
      logStep("Confirmation email sent", { status: emailResponse.status });
    } catch (emailError) {
      // Don't fail the withdrawal if email fails
      logStep("Email send error (non-blocking)", { error: String(emailError) });
    }

    return new Response(JSON.stringify({ 
      success: true,
      payment_id: payment.id,
      amount,
      fee,
      net_amount: netAmount,
      message: "Solicitação de saque recebida. Processamento em até 24h úteis."
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
