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
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

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

    // Check market status and trading halt before atomic operation
    const { data: market, error: marketError } = await supabaseAdmin
      .from("markets")
      .select("id, title, status, close_date")
      .eq("id", marketId)
      .single();

    if (marketError || !market) {
      return new Response(
        JSON.stringify({ success: false, message: "Mercado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (market.status !== "OPEN") {
      return new Response(
        JSON.stringify({ success: false, message: "Este mercado não está aberto para negociação" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (market.close_date && new Date(market.close_date) <= new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: "As negociações estão encerradas para este mercado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute atomic trade using the database function
    // This prevents race conditions by using row-level locks
    const { data: result, error: tradeError } = await supabaseAdmin.rpc(
      "atomic_execute_trade",
      {
        p_user_id: userId,
        p_market_id: marketId,
        p_outcome: outcome,
        p_shares: shares,
        p_max_cost: maxCost || 999999999,
      }
    );

    if (tradeError) {
      console.error("Atomic trade error:", tradeError);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao executar operação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tradeResult = result as {
      success: boolean;
      error?: string;
      trade_cost?: number;
      shares?: number;
      price_per_share?: number;
      new_yes_price?: number;
      new_no_price?: number;
      transaction_id?: string;
      contract_id?: string;
      new_balance?: number;
    };

    if (!tradeResult.success) {
      const errorMessage = tradeResult.error === "Wallet not found"
        ? "Carteira não encontrada"
        : tradeResult.error === "Market not found"
        ? "Mercado não encontrado"
        : tradeResult.error === "Market is not open for trading"
        ? "Este mercado não está aberto para negociação"
        : tradeResult.error === "Price exceeded maximum cost (slippage protection)"
        ? "O preço mudou significativamente. Por favor, atualize e tente novamente."
        : tradeResult.error === "Insufficient balance"
        ? "Saldo insuficiente"
        : tradeResult.error || "Erro desconhecido";

      return new Response(
        JSON.stringify({ success: false, message: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Compra realizada com sucesso!",
        contract: {
          id: tradeResult.contract_id,
          eventId: marketId,
          eventTitle: market.title,
          outcome,
          quantity: shares,
          priceAtPurchase: Math.round((tradeResult.price_per_share || 0) * 100),
          purchasedAt: new Date().toISOString(),
          status: "ACTIVE",
        },
        quote: {
          cost: tradeResult.trade_cost,
          avgPrice: Math.round((tradeResult.price_per_share || 0) * 100),
          newYesPrice: Math.round((tradeResult.new_yes_price || 0) * 100),
          newNoPrice: Math.round((tradeResult.new_no_price || 0) * 100),
        },
        feeAmount: 0,
        totalDeduction: tradeResult.trade_cost,
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
