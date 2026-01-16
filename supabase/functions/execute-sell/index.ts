import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SellRequest {
  contractId: string;
  shares?: number;
  minValue?: number;
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
    const { contractId, shares: requestedShares, minValue } = body;

    if (!contractId) {
      return new Response(
        JSON.stringify({ success: false, message: "ID do contrato é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contract to get shares count (if not provided) and validate ownership
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("user_contracts")
      .select("id, shares, position, market_id, markets(title)")
      .eq("id", contractId)
      .eq("user_id", userId)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ success: false, message: "Contrato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sharesToSell = requestedShares || contract.shares;

    // Execute atomic sell using the database function
    // This prevents race conditions by using row-level locks
    const { data: result, error: sellError } = await supabaseAdmin.rpc(
      "atomic_execute_sell",
      {
        p_user_id: userId,
        p_contract_id: contractId,
        p_shares: sharesToSell,
        p_min_value: minValue || 0,
      }
    );

    if (sellError) {
      console.error("Atomic sell error:", sellError);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao executar operação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sellResult = result as {
      success: boolean;
      error?: string;
      sell_value?: number;
      shares?: number;
      price_per_share?: number;
      new_yes_price?: number;
      new_no_price?: number;
      transaction_id?: string;
      new_balance?: number;
    };

    if (!sellResult.success) {
      const errorMessage = sellResult.error === "Contract not found"
        ? "Contrato não encontrado"
        : sellResult.error === "Insufficient shares"
        ? "Quantidade de contratos insuficiente"
        : sellResult.error === "Wallet not found"
        ? "Carteira não encontrada"
        : sellResult.error === "Market not found"
        ? "Mercado não encontrado"
        : sellResult.error === "Market is not open for trading"
        ? "Este mercado não está aberto para negociação"
        : sellResult.error === "Price below minimum value (slippage protection)"
        ? "O preço mudou significativamente. Por favor, atualize e tente novamente."
        : sellResult.error || "Erro desconhecido";

      return new Response(
        JSON.stringify({ success: false, message: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const marketData = contract.markets as unknown as { title: string } | null;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Venda realizada com sucesso!",
        saleValue: sellResult.sell_value,
        quote: {
          cost: sellResult.sell_value,
          avgPrice: Math.round((sellResult.price_per_share || 0) * 100),
          newYesPrice: Math.round((sellResult.new_yes_price || 0) * 100),
          newNoPrice: Math.round((sellResult.new_no_price || 0) * 100),
        },
        feeAmount: 0,
        contract: {
          id: contractId,
          marketTitle: marketData?.title || "",
          position: contract.position,
          shares: sharesToSell,
        },
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
