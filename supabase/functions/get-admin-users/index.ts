import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SortField = "display_name" | "email" | "balance_available" | "balance_total" | "updated_at" | "created_at";
type SortOrder = "asc" | "desc";

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
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is admin
    const { data: hasAdminRole } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body for pagination/search/sort
    let search = "";
    let limit = 20;
    let offset = 0;
    let sortBy: SortField = "updated_at";
    let sortOrder: SortOrder = "desc";
    let filterBlocked: boolean | null = null;
    let filterRole: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        search = body.search || "";
        limit = Math.min(Math.max(body.limit || 20, 1), 100);
        offset = Math.max(body.offset || 0, 0);
        sortBy = body.sortBy || "updated_at";
        sortOrder = body.sortOrder || "desc";
        filterBlocked = body.filterBlocked ?? null;
        filterRole = body.filterRole || null;
      } catch {
        // Use defaults
      }
    }

    const orderField = ["display_name", "email", "created_at", "updated_at"].includes(sortBy) ? sortBy : "updated_at";
    let query = supabaseAdmin.from("profiles").select("id,display_name,full_name,email,phone,is_blocked,blocked_at,blocked_reason,created_at,updated_at", { count: "exact" });
    const cleanSearch = String(search).replace(/[(),%_\\]/g, "").trim().slice(0, 100);
    if (cleanSearch) query = query.or(`display_name.ilike.%${cleanSearch}%,full_name.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
    if (filterBlocked !== null) query = query.eq("is_blocked", filterBlocked);
    if (filterRole) {
      const { data: roleMatches, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", filterRole);
      if (error) throw error;
      const ids = (roleMatches ?? []).map((row: any) => row.user_id);
      if (!ids.length) return new Response(JSON.stringify({ users: [], pagination: { total: 0, limit, offset, hasMore: false } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      query = query.in("id", ids);
    }
    const { data: profiles, count, error: profilesError } = await query.order(orderField, { ascending: sortOrder === "asc" }).order("id").range(offset, offset + limit - 1);
    if (profilesError) throw profilesError;
    const ids = (profiles ?? []).map((profile: any) => profile.id);
    let wallets: any[] = [], roles: any[] = [];
    if (ids.length) {
      const [walletResult, roleResult] = await Promise.all([
        supabaseAdmin.from("polymarket_paper_wallets").select("user_id,balance_usd").in("user_id", ids),
        supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
      ]);
      if (walletResult.error || roleResult.error) throw walletResult.error ?? roleResult.error;
      wallets = walletResult.data ?? []; roles = roleResult.data ?? [];
    }
    const users = (profiles ?? []).map((profile: any) => {
      const wallet = wallets.find(row => row.user_id === profile.id);
      return { ...profile, id: profile.id, user_id: profile.id, display_name: profile.display_name || profile.full_name || "Sem nome", email: profile.email ?? "N/A", balance_available: wallet ? Number(wallet.balance_usd) : null, balance_locked: 0, currency: "USD", roles: roles.filter(row => row.user_id === profile.id).map(row => row.role) };
    });
    return new Response(JSON.stringify({ users, pagination: { total: count ?? 0, limit, offset, hasMore: offset + users.length < (count ?? 0) } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[GET-ADMIN-USERS] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
