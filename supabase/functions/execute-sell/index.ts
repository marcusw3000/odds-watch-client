import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SellRequest {
  contractId: string;
  minValue?: number;
}

interface LMSRState {
  qYes: number;
  qNo: number;
  b: number;
}

// LMSR Cost function
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

function getValueToSell(state: LMSRState, outcome: "YES" | "NO", shares: number): number {
  const { qYes, qNo, b } = state;
  const currentCost = costFunction(qYes, qNo, b);
  let newCost: number;
  if (outcome === "YES") {
    newCost = costFunction(qYes - shares, qNo, b);
  } else {
    newCost = costFunction(qYes, qNo - shares, b);
  }
  return currentCost - newCost;
}

function executeSell(state: LMSRState, outcome: "YES" | "NO", shares: number): LMSRState {
  if (outcome === "YES") {
    return { ...state, qYes: Math.max(0, state.qYes - shares) };
  } else {
    return { ...state, qNo: Math.max(0, state.qNo - shares) };
  }
}

// Trading fee - disabled
function calculateTradingFee(contracts: number, pricePerContract: number): number {
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    const body: SellRequest = await req.json();
    const { contractId, minValue } = body;

    if (!contractId) {
      return new Response(
        JSON.stringify({ success: false, message: "ID do contrato é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contract with market info
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("user_contracts")
      .select("*, markets(title, yes_shares, no_shares, lmsr_b, status)")
      .eq("id", contractId)
      .eq("user_id", userId)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ success: false, message: "Contrato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const market = contract.markets as {
      title: string;
      yes_shares: number;
      no_shares: number;
      lmsr_b: number;
      status: string;
    };

    if (market.status !== "OPEN") {
      return new Response(
        JSON.stringify({ success: false, message: "Este mercado não está aberto para negociação" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lmsr: LMSRState = {
      b: market.lmsr_b,
      qYes: market.yes_shares,
      qNo: market.no_shares,
    };

    const position = contract.position as "YES" | "NO";
    const shares = contract.shares;
    const value = getValueToSell(lmsr, position, shares);
    const avgPrice = (value / shares) * 100;

    // Check slippage protection
    if (minValue && value < minValue * 0.95) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "O preço mudou significativamente. Por favor, atualize e tente novamente.",
          quote: { cost: value, avgPrice: Math.round(avgPrice) },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate fee
    const pricePerContract = avgPrice / 100;
    const feeAmount = calculateTradingFee(shares, pricePerContract);
    const netProceeds = value - feeAmount;

    // Execute sell - update market state
    const newState = executeSell(lmsr, position, shares);
    const newYesPrice = getPriceYes(newState);
    const newNoPrice = getPriceNo(newState);

    await supabaseAdmin
      .from("markets")
      .update({
        yes_shares: newState.qYes,
        no_shares: newState.qNo,
        current_yes_price: newYesPrice / 100,
        current_no_price: newNoPrice / 100,
      })
      .eq("id", contract.market_id);

    // Get wallet and update balance
    const { data: walletData } = await supabaseAdmin
      .from("wallets")
      .select("id, balance_available")
      .eq("user_id", userId)
      .single();

    await supabaseAdmin
      .from("wallets")
      .update({ balance_available: (walletData?.balance_available || 0) + netProceeds })
      .eq("user_id", userId);

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
        ref_id: contract.market_id,
        direction: "CREDIT",
        amount: value,
        fee_amount: feeAmount,
        net_amount: netProceeds,
        platform_revenue: feeAmount,
        fee_snapshot_id: feeSnapshot.id,
        status: "COMPLETED",
        meta: { action: "SELL", position, shares, contractId },
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

    // Delete contract
    await supabaseAdmin.from("user_contracts").delete().eq("id", contractId);

    // Record transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      market_id: contract.market_id,
      type: "SELL",
      position,
      shares,
      price_per_share: avgPrice / 100,
      total_amount: netProceeds,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: feeAmount > 0
          ? `Venda realizada com sucesso! Taxa: R$ ${feeAmount.toFixed(2)}`
          : "Venda realizada com sucesso!",
        saleValue: netProceeds,
        quote: {
          cost: value,
          avgPrice: Math.round(avgPrice),
          newYesPrice,
          newNoPrice,
        },
        feeAmount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute sell error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
