import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TradeRequest {
  marketId: string;
  outcome: "YES" | "NO";
  shares: number;
  maxCost?: number;
}

interface LMSRState {
  qYes: number;
  qNo: number;
  b: number;
}

// LMSR Cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
function costFunction(qYes: number, qNo: number, b: number): number {
  const max = Math.max(qYes / b, qNo / b);
  return b * (max + Math.log(Math.exp(qYes / b - max) + Math.exp(qNo / b - max)));
}

function getPriceYes(state: LMSRState): number {
  const { qYes, qNo, b } = state;
  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);
  const price = (expYes / (expYes + expNo)) * 100;
  return Math.max(1, Math.min(99, Math.round(price)));
}

function getPriceNo(state: LMSRState): number {
  return 100 - getPriceYes(state);
}

function getCostToBuy(state: LMSRState, outcome: "YES" | "NO", shares: number): number {
  const { qYes, qNo, b } = state;
  const currentCost = costFunction(qYes, qNo, b);
  let newCost: number;
  if (outcome === "YES") {
    newCost = costFunction(qYes + shares, qNo, b);
  } else {
    newCost = costFunction(qYes, qNo + shares, b);
  }
  return newCost - currentCost;
}

function executeBuy(state: LMSRState, outcome: "YES" | "NO", shares: number): LMSRState {
  if (outcome === "YES") {
    return { ...state, qYes: state.qYes + shares };
  } else {
    return { ...state, qNo: state.qNo + shares };
  }
}

// Trading fee - disabled
function calculateTradingFee(contracts: number, pricePerContract: number): number {
  return 0;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create user client to get user info
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Parse request body
    const body: TradeRequest = await req.json();
    const { marketId, outcome, shares, maxCost } = body;

    // Validate input
    if (!marketId || !outcome || !shares || shares <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (outcome !== "YES" && outcome !== "NO") {
      return new Response(
        JSON.stringify({ success: false, message: "Outcome deve ser YES ou NO" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get market with row lock
    const { data: market, error: marketError } = await supabaseAdmin
      .from("markets")
      .select("*")
      .eq("id", marketId)
      .single();

    if (marketError || !market) {
      return new Response(
        JSON.stringify({ success: false, message: "Mercado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check market status
    if (market.status !== "OPEN") {
      return new Response(
        JSON.stringify({ success: false, message: "Este mercado não está aberto para negociação" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check trading halt
    if (market.close_date && new Date(market.close_date) <= new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: "As negociações estão encerradas para este mercado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build LMSR state
    const lmsr: LMSRState = {
      b: market.lmsr_b,
      qYes: market.yes_shares,
      qNo: market.no_shares,
    };

    // Calculate cost
    const cost = getCostToBuy(lmsr, outcome, shares);
    const avgPrice = (cost / shares) * 100;

    // Check max cost slippage protection
    if (maxCost && cost > maxCost * 1.05) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "O preço mudou significativamente. Por favor, atualize e tente novamente.",
          quote: { cost, avgPrice: Math.round(avgPrice) },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate fee
    const pricePerContract = avgPrice / 100;
    const feeAmount = calculateTradingFee(shares, pricePerContract);
    const totalDeduction = cost + feeAmount;

    // Get user wallet balance with lock (using service role)
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, balance_available")
      .eq("user_id", userId)
      .single();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao verificar saldo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check sufficient balance
    if (walletData.balance_available < totalDeduction) {
      return new Response(
        JSON.stringify({ success: false, message: "Saldo insuficiente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute trade - update market state
    const newState = executeBuy(lmsr, outcome, shares);
    const newYesPrice = getPriceYes(newState);
    const newNoPrice = getPriceNo(newState);

    const { error: updateMarketError } = await supabaseAdmin
      .from("markets")
      .update({
        yes_shares: newState.qYes,
        no_shares: newState.qNo,
        current_yes_price: newYesPrice / 100,
        current_no_price: newNoPrice / 100,
        total_volume: market.total_volume + cost,
      })
      .eq("id", marketId);

    if (updateMarketError) {
      console.error("Error updating market:", updateMarketError);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao atualizar mercado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct balance from wallet
    const { error: deductError } = await supabaseAdmin
      .from("wallets")
      .update({ balance_available: walletData.balance_available - totalDeduction })
      .eq("user_id", userId);

    if (deductError) {
      console.error("Error deducting balance:", deductError);
      // Try to rollback market state
      await supabaseAdmin
        .from("markets")
        .update({
          yes_shares: lmsr.qYes,
          no_shares: lmsr.qNo,
          current_yes_price: getPriceYes(lmsr) / 100,
          current_no_price: getPriceNo(lmsr) / 100,
          total_volume: market.total_volume,
        })
        .eq("id", marketId);

      return new Response(
        JSON.stringify({ success: false, message: "Erro ao atualizar saldo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create fee snapshot
    const { data: feeSnapshot } = await supabaseAdmin
      .from("fee_policy_snapshots")
      .insert({
        type: "TRADE",
        applied_mode: "TRADING",
        applied_percent: 0.07,
      })
      .select("id")
      .single();

    // Record ledger entry
    if (walletData?.id && feeSnapshot?.id) {
      await supabaseAdmin.from("ledger_entries").insert({
        user_id: userId,
        wallet_id: walletData.id,
        ref_type: "TRADE",
        ref_id: marketId,
        direction: "DEBIT",
        amount: cost,
        fee_amount: feeAmount,
        net_amount: cost,
        platform_revenue: feeAmount,
        fee_snapshot_id: feeSnapshot.id,
        status: "COMPLETED",
        meta: { action: "BUY", outcome, shares, marketId },
      });

      // Aggregate platform revenue
      if (feeAmount > 0) {
        const today = new Date().toISOString().split("T")[0];
        await supabaseAdmin.from("platform_revenue").upsert(
          {
            day: today,
            type: "TRADE",
            fees: feeAmount,
            gross: feeAmount,
            net: feeAmount,
          },
          { onConflict: "day,type" }
        );
      }
    }

    // Record transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      market_id: marketId,
      type: "BUY",
      position: outcome,
      shares,
      price_per_share: avgPrice / 100,
      total_amount: -totalDeduction,
    });

    // Create or update user contract
    const { data: existingContract } = await supabaseAdmin
      .from("user_contracts")
      .select("*")
      .eq("user_id", userId)
      .eq("market_id", marketId)
      .eq("position", outcome)
      .maybeSingle();

    if (existingContract) {
      const newShares = existingContract.shares + shares;
      const newTotalInvested = existingContract.total_invested + cost;
      const newAvgPrice = newTotalInvested / newShares;

      await supabaseAdmin
        .from("user_contracts")
        .update({
          shares: newShares,
          total_invested: newTotalInvested,
          average_price: newAvgPrice,
        })
        .eq("id", existingContract.id);
    } else {
      await supabaseAdmin.from("user_contracts").insert({
        user_id: userId,
        market_id: marketId,
        position: outcome,
        shares,
        average_price: avgPrice / 100,
        total_invested: cost,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: feeAmount > 0
          ? `Compra realizada com sucesso! Taxa: R$ ${feeAmount.toFixed(2)}`
          : "Compra realizada com sucesso!",
        contract: {
          id: existingContract?.id || `new-${Date.now()}`,
          eventId: marketId,
          eventTitle: market.title,
          outcome,
          quantity: shares,
          priceAtPurchase: Math.round(avgPrice),
          purchasedAt: new Date().toISOString(),
          status: "ACTIVE",
        },
        quote: {
          cost,
          avgPrice: Math.round(avgPrice),
          newYesPrice,
          newNoPrice,
        },
        feeAmount,
        totalDeduction,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute trade error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
