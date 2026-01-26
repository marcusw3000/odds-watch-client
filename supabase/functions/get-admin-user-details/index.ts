import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createFunctionLogger, logPerformance } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const startTime = performance.now();
  const logger = createFunctionLogger("get-admin-user-details");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.step("Starting get-admin-user-details request");

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      logger.error("Authentication failed", { error: claimsError });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actorUserId = claimsData.user.id;
    logger.step("User authenticated", { actorUserId });

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if actor is admin
    const { data: hasAdminRole } = await supabaseAdmin.rpc("has_role", {
      _user_id: actorUserId,
      _role: "admin",
    });

    if (!hasAdminRole) {
      logger.step("Access denied - not admin");
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user_id from request
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Fetching user details", { user_id });

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch wallet
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    // Fetch roles
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);

    // Fetch recent contracts (last 50)
    const { data: contracts } = await supabaseAdmin
      .from("user_contracts")
      .select(`
        id,
        market_id,
        position,
        shares,
        average_price,
        total_invested,
        created_at,
        updated_at,
        option_id,
        markets!inner(id, title, status, result)
      `)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch recent ledger entries (last 50)
    const { data: ledgerEntries } = await supabaseAdmin
      .from("ledger_entries")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch recent notifications (last 20)
    const { data: notifications } = await supabaseAdmin
      .from("notifications")
      .select("id, type, title, message, is_read, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch referral stats
    const { data: referralStats } = await supabaseAdmin
      .from("referrals")
      .select("id, status, created_at")
      .eq("referrer_id", user_id);

    // Fetch admin audit logs for this user
    const { data: auditLogs } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("id, action, entity, entity_id, before_data, after_data, created_at, actor_user_id")
      .eq("entity_id", user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Calculate stats - status values are: OPEN, HALTED, PENDING, SETTLED (uppercase enum)
    const contractStats = contracts ? {
      total: contracts.length,
      active: contracts.filter((c: any) => 
        c.markets?.status === 'OPEN' || c.markets?.status === 'HALTED'
      ).length,
      won: contracts.filter((c: any) => 
        c.markets?.status === 'SETTLED' && 
        c.markets?.result?.toUpperCase() === c.position?.toUpperCase()
      ).length,
      lost: contracts.filter((c: any) => 
        c.markets?.status === 'SETTLED' && 
        c.markets?.result?.toUpperCase() !== c.position?.toUpperCase()
      ).length,
    } : { total: 0, active: 0, won: 0, lost: 0 };

    const referralStatsComputed = referralStats ? {
      total: referralStats.length,
      activated: referralStats.filter((r: any) => r.status === "activated").length,
      pending: referralStats.filter((r: any) => r.status === "pending").length,
    } : { total: 0, activated: 0, pending: 0 };

    logger.step("User details fetched successfully");

    logPerformance({
      functionName: "get-admin-user-details",
      duration: performance.now() - startTime,
      userId: actorUserId,
      success: true,
      metadata: { targetUserId: user_id },
    });

    return new Response(
      JSON.stringify({
        profile: {
          id: profile.id,
          display_name: profile.display_name,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          cpf: profile.cpf ? `***.***.***-${profile.cpf.slice(-2)}` : null, // Masked CPF
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          is_public: profile.is_public,
          is_blocked: profile.is_blocked,
          blocked_at: profile.blocked_at,
          blocked_reason: profile.blocked_reason,
          blocked_by: profile.blocked_by,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        },
        wallet: wallet ? {
          id: wallet.id,
          balance_available: wallet.balance_available,
          balance_locked: wallet.balance_locked,
          currency: wallet.currency,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at,
        } : null,
        roles: (roles || []).map((r: any) => r.role),
        contracts: (contracts || []).map((c: any) => ({
          id: c.id,
          market_id: c.market_id,
          market_title: c.markets?.title,
          market_status: c.markets?.status,
          market_result: c.markets?.result,
          position: c.position,
          shares: c.shares,
          average_price: c.average_price,
          total_invested: c.total_invested,
          created_at: c.created_at,
          option_id: c.option_id,
        })),
        contractStats,
        ledgerEntries: ledgerEntries || [],
        notifications: notifications || [],
        referralStats: referralStatsComputed,
        auditLogs: (auditLogs || []).map((log: any) => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          before_data: log.before_data,
          after_data: log.after_data,
          created_at: log.created_at,
          actor_user_id: log.actor_user_id,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Unexpected error", { error });

    logPerformance({
      functionName: "get-admin-user-details",
      duration: performance.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
