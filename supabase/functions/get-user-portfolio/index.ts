import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all portfolio data in parallel
    const [walletResult, contractsResult, transactionsResult] = await Promise.all([
      supabaseAdmin
        .from("wallets")
        .select("balance_available")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_contracts")
        .select("id, market_id, position, shares, average_price, total_invested, created_at, markets!user_contracts_market_id_fkey(title, status, result)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("transactions")
        .select("id, type, position, shares, price_per_share, total_amount, created_at, markets!fk_transactions_market(title)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (walletResult.error) {
      console.error("[GET-USER-PORTFOLIO] Error fetching wallet:", walletResult.error);
    }

    if (contractsResult.error) {
      console.error("[GET-USER-PORTFOLIO] Error fetching contracts:", contractsResult.error);
    }

    if (transactionsResult.error) {
      console.error("[GET-USER-PORTFOLIO] Error fetching transactions:", transactionsResult.error);
    }

    const balance = walletResult.data?.balance_available ?? 0;

    // Transform contracts - remove internal IDs, only essential info
    const contracts = (contractsResult.data || []).map((c: any) => {
      const market = c.markets;
      const marketStatus = market?.status ?? "OPEN";
      const marketResult = market?.result;
      
      let status: "ACTIVE" | "WON" | "LOST" = "ACTIVE";
      let payout: number | undefined;
      
      if (marketStatus === "SETTLED" && marketResult) {
        if (marketResult === c.position) {
          status = "WON";
          payout = c.shares; // 1 BRL per winning share
        } else {
          status = "LOST";
        }
      }

      return {
        id: c.id,
        eventId: c.market_id,
        eventTitle: market?.title || "Unknown",
        outcome: c.position,
        quantity: c.shares,
        priceAtPurchase: c.average_price * 100,
        purchasedAt: c.created_at,
        status,
        payout,
      };
    });

    // Transform transactions - sanitized
    const transactions = (transactionsResult.data || []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: t.total_amount,
      eventTitle: t.markets?.title,
      outcome: t.position,
      createdAt: t.created_at,
    }));

    // Calculate total invested from active contracts
    const activeContracts = contracts.filter((c: any) => c.status === "ACTIVE");
    const totalInvested = activeContracts.reduce(
      (sum: number, c: any) => sum + (c.priceAtPurchase / 100) * c.quantity,
      0
    );

    // Calculate profit from settled contracts
    const settledContracts = contracts.filter((c: any) => c.status !== "ACTIVE");
    const totalPayout = settledContracts
      .filter((c: any) => c.status === "WON")
      .reduce((sum: number, c: any) => sum + (c.payout || 0), 0);
    const totalLost = settledContracts
      .filter((c: any) => c.status === "LOST")
      .reduce((sum: number, c: any) => sum + (c.priceAtPurchase / 100) * c.quantity, 0);

    const totalProfit = totalPayout - totalLost;

    return new Response(
      JSON.stringify({
        balance,
        totalInvested,
        totalProfit,
        contracts,
        transactions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GET-USER-PORTFOLIO] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
