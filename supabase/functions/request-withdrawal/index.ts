import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    logStep("Request validated", { amount, pix_key_type });

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

    // Check for pending duplicate withdrawal in last 30 seconds
    const { data: hasPendingDuplicate, error: pendingCheckError } = await supabaseAdmin
      .rpc('check_pending_withdrawal', {
        p_user_id: user.id,
        p_amount: amount,
        p_pix_key: pix_key
      });

    if (pendingCheckError) {
      logStep("Pending check error", { error: pendingCheckError.message });
    }

    if (hasPendingDuplicate) {
      logStep("Pending duplicate withdrawal detected", { userId: user.id, amount, pix_key });
      throw new Error("Já existe um saque pendente com estes dados. Aguarde o processamento.");
    }
    logStep("No duplicate withdrawals found");

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

    // No withdrawal fee
    const fee = 0;
    const netAmount = amount;

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
        pix_key: pix_key,
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
    logStep("Withdrawal request created", { paymentId: payment.id, idempotencyKey });
    // Note: Balance was already atomically deducted by atomic_withdraw_balance

    // Create notification
    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: user.id,
        type: "TRADE_EXECUTED",
        title: "Solicitação de Saque Recebida",
        message: `Seu saque de R$${netAmount.toFixed(2)} está sendo processado.`,
        data: { amount, fee, net_amount: netAmount, payment_id: payment.id },
      });

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
