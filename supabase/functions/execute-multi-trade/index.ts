import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MultiTradeRequest {
  marketId: string;
  optionId: string;
  shares: number;
  maxCost?: number;
  side?: 'YES' | 'NO';  // YES = bet option wins, NO = bet option loses
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

    // Check if user is blocked
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_blocked")
      .eq("id", user.id)
      .single();
    
    if (profile?.is_blocked) {
      return new Response(
        JSON.stringify({ success: false, message: "Usuário bloqueado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: MultiTradeRequest = await req.json();
    const { marketId, optionId, shares, maxCost, side = 'YES' } = body;

    // Validation
    if (!marketId || !optionId || !shares || shares <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (shares < 0.01) {
      return new Response(
        JSON.stringify({ success: false, message: "Quantidade mínima é 0.01 contratos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Choose the appropriate function based on side (YES or NO)
    const functionName = side === 'NO' 
      ? "atomic_execute_multi_no_trade" 
      : "atomic_execute_multi_trade";

    // Execute atomic trade
    const { data: result, error: tradeError } = await supabaseAdmin.rpc(
      functionName,
      {
        p_user_id: user.id,
        p_market_id: marketId,
        p_option_id: optionId,
        p_shares: shares,
        p_max_cost: maxCost || 999999999,
      }
    );

    if (tradeError) {
      console.error(`Multi trade error (${side}):`, tradeError);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao executar operação", error: tradeError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result || !result.success) {
      const errorMessage = result?.error || "Erro desconhecido";
      console.error("Multi trade failed:", errorMessage);
      return new Response(
        JSON.stringify({ success: false, message: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contractType = result.contract_type || side;
    const messagePrefix = contractType === 'NO' ? 'NÃO' : 'SIM';
    
    console.log(`Multi-option ${contractType} trade executed: user=${user.id}, market=${marketId}, option=${optionId}, shares=${shares}, cost=${result.trade_cost}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Compra ${messagePrefix} realizada com sucesso!`,
        contract: {
          id: result.contract_id,
          marketId: marketId,
          optionId,
          shares: shares,
          priceAtPurchase: Math.round((result.price_per_share || 0) * 100),
          purchasedAt: new Date().toISOString(),
          status: "ACTIVE",
          contractType: contractType,
        },
        quote: {
          cost: result.trade_cost,
          avgPrice: Math.round((result.price_per_share || 0) * 100),
          newPrices: result.new_prices,
        },
        newBalance: result.new_balance,
        transactionId: result.transaction_id,
        contractType: contractType,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute multi trade error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
