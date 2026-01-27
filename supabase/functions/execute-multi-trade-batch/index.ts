import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MultiTradeBatchRequest {
  marketId: string;
  excludeOptionId: string;  // The option user is betting NO on
  totalCost: number;        // Total amount to spend
  maxSlippage?: number;     // Slippage tolerance (default 5%)
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

    const body: MultiTradeBatchRequest = await req.json();
    const { marketId, excludeOptionId, totalCost, maxSlippage = 0.05 } = body;

    // Validation
    if (!marketId || !excludeOptionId || !totalCost) {
      return new Response(
        JSON.stringify({ success: false, message: "Parâmetros inválidos: marketId, excludeOptionId e totalCost são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (totalCost <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: "O valor total deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (totalCost < 10) {
      return new Response(
        JSON.stringify({ success: false, message: "Valor mínimo é R$10" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute atomic batch trade
    const { data: result, error: tradeError } = await supabaseAdmin.rpc(
      "atomic_execute_multi_trade_batch",
      {
        p_user_id: user.id,
        p_market_id: marketId,
        p_exclude_option_id: excludeOptionId,
        p_total_cost: totalCost,
        p_max_slippage: maxSlippage,
      }
    );

    if (tradeError) {
      console.error("Multi trade batch error:", tradeError);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao executar operação", error: tradeError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result || !result.success) {
      const errorMessage = result?.error || "Erro desconhecido";
      console.error("Multi trade batch failed:", errorMessage);
      return new Response(
        JSON.stringify({ success: false, message: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Multi-option NO trade executed: user=${user.id}, market=${marketId}, excluded=${excludeOptionId}, cost=${result.total_cost}, contracts=${result.contracts?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Compra NÃO realizada com sucesso!",
        contracts: result.contracts,
        totalCost: result.total_cost,
        newBalance: result.new_balance,
        excludedOptionId: result.excluded_option_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Execute multi trade batch error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
