import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiting: store sell counts per user in memory (resets on function restart)
const sellRateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_SELLS_PER_WINDOW = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = sellRateLimits.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    sellRateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= MAX_SELLS_PER_WINDOW) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

interface SellRequest {
  contractId: string;
  shares?: number;
  minValue?: number;
}

// Input validation functions
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
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

    // Check rate limit
    if (!checkRateLimit(userId)) {
      console.log(`[EXECUTE-SELL] Rate limit exceeded for user ${userId}`);
      return new Response(
        JSON.stringify({ success: false, message: "Muitas operações em sequência. Aguarde alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SellRequest = await req.json();
    const { contractId, shares: rawShares, minValue: rawMinValue } = body;

    // Strict input validation
    if (!contractId || typeof contractId !== "string" || !isValidUUID(contractId)) {
      return new Response(
        JSON.stringify({ success: false, message: "ID do contrato inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate shares if provided
    const requestedShares = rawShares !== undefined ? sanitizeNumber(rawShares, 0.01, 10000) : undefined;
    if (rawShares !== undefined && requestedShares === null) {
      return new Response(
        JSON.stringify({ success: false, message: "Quantidade de contratos inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate minValue if provided
    const minValue = rawMinValue !== undefined ? sanitizeNumber(rawMinValue, 0, 1000000) : 0;
    if (rawMinValue !== undefined && minValue === null) {
      return new Response(
        JSON.stringify({ success: false, message: "Valor mínimo inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contract to get shares count (if not provided) and validate ownership
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("user_contracts")
      .select("id, shares, position, market_id, option_id, markets!user_contracts_market_id_fkey(title)")
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

    const isMultiOption = contract.position === 'OPTION' && contract.option_id != null;
    
    console.log('[EXECUTE-SELL] Request:', {
      userId,
      contractId,
      shares: sharesToSell,
      minValue: minValue || 0,
      position: contract.position,
      isMultiOption,
      optionId: contract.option_id,
    });

    // Execute atomic sell using the appropriate database function
    // Multi-option markets use atomic_execute_multi_sell
    // Binary markets use atomic_execute_sell
    const rpcName = isMultiOption ? "atomic_execute_multi_sell" : "atomic_execute_sell";
    
    const { data: result, error: sellError } = await supabaseAdmin.rpc(
      rpcName,
      {
        p_user_id: userId,
        p_contract_id: contractId,
        p_shares: sharesToSell,
        p_min_value: minValue || 0,
      }
    );

    if (sellError) {
      console.error(`[EXECUTE-SELL] ${rpcName} error:`, sellError);
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
      console.log('[EXECUTE-SELL] Sell failed:', { error: sellResult.error, minValue, sellResult });
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

    console.log('[EXECUTE-SELL] Success:', {
      userId,
      contractId,
      shares: sharesToSell,
      sellValue: sellResult.sell_value,
      pricePerShare: sellResult.price_per_share,
    });

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
