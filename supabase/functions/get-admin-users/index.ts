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

    // First get total count for pagination
    let countQuery = supabaseAdmin
      .from("wallets")
      .select("id", { count: "exact", head: true });

    const { count: totalCount } = await countQuery;

    // Build main query - fetch all wallets with pagination
    let walletsQuery = supabaseAdmin
      .from("wallets")
      .select("id, user_id, balance_available, balance_locked, currency, created_at, updated_at");

    // Apply sorting for wallet fields
    if (sortBy === "balance_available" || sortBy === "balance_total") {
      walletsQuery = walletsQuery.order("balance_available", { ascending: sortOrder === "asc" });
    } else if (sortBy === "updated_at" || sortBy === "created_at") {
      walletsQuery = walletsQuery.order(sortBy, { ascending: sortOrder === "asc" });
    } else {
      walletsQuery = walletsQuery.order("updated_at", { ascending: false });
    }

    walletsQuery = walletsQuery.range(offset, offset + limit - 1);

    const { data: walletsData, error: walletsError } = await walletsQuery;

    if (walletsError) {
      console.error("[GET-ADMIN-USERS] Error fetching wallets:", walletsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user IDs and fetch profiles
    const userIds = (walletsData || []).map((w: any) => w.user_id);

    const { data: profilesData } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name, email, phone, is_blocked, blocked_at, blocked_reason")
      .in("id", userIds);

    const profilesMap = new Map<string, { 
      display_name: string | null; 
      full_name: string | null; 
      email: string | null;
      phone: string | null;
      is_blocked: boolean;
      blocked_at: string | null;
      blocked_reason: string | null;
    }>();
    (profilesData || []).forEach((p: any) => {
      profilesMap.set(p.id, {
        display_name: p.display_name,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        is_blocked: p.is_blocked ?? false,
        blocked_at: p.blocked_at,
        blocked_reason: p.blocked_reason,
      });
    });

    // Fetch roles for all users
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const rolesMap = new Map<string, string[]>();
    (rolesData || []).forEach((r: { user_id: string; role: string }) => {
      const existing = rolesMap.get(r.user_id) || [];
      existing.push(r.role);
      rolesMap.set(r.user_id, existing);
    });

    // Build response with filtering
    let users = (walletsData || [])
      .map((wallet: any) => {
        const profile = profilesMap.get(wallet.user_id);
        const displayName = profile?.display_name || profile?.full_name || "Sem nome";
        const email = profile?.email;
        const roles = rolesMap.get(wallet.user_id) || [];

        return {
          id: wallet.id,
          user_id: wallet.user_id,
          display_name: displayName,
          email: email ?? "N/A",
          phone: profile?.phone ?? null,
          balance_available: wallet.balance_available,
          balance_locked: wallet.balance_locked,
          currency: wallet.currency,
          is_blocked: profile?.is_blocked ?? false,
          blocked_at: profile?.blocked_at ?? null,
          blocked_reason: profile?.blocked_reason ?? null,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at,
          roles: roles,
        };
      });

    // Apply search filter (client-side for simplicity with joined data)
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter((u: any) => {
        const matchesName = u.display_name.toLowerCase().includes(searchLower);
        const matchesEmail = u.email?.toLowerCase().includes(searchLower);
        const matchesId = u.user_id.toLowerCase().includes(searchLower);
        const matchesRole = u.roles.some((r: string) => r.toLowerCase().includes(searchLower));
        return matchesName || matchesEmail || matchesId || matchesRole;
      });
    }

    // Apply blocked filter
    if (filterBlocked !== null) {
      users = users.filter((u: any) => u.is_blocked === filterBlocked);
    }

    // Apply role filter
    if (filterRole) {
      users = users.filter((u: any) => u.roles.includes(filterRole));
    }

    // Sort by display_name or email if requested (needs to be done after joining)
    if (sortBy === "display_name") {
      users.sort((a: any, b: any) => {
        const cmp = a.display_name.localeCompare(b.display_name);
        return sortOrder === "asc" ? cmp : -cmp;
      });
    } else if (sortBy === "email") {
      users.sort((a: any, b: any) => {
        const cmp = (a.email || "").localeCompare(b.email || "");
        return sortOrder === "asc" ? cmp : -cmp;
      });
    }

    return new Response(
      JSON.stringify({ 
        users,
        pagination: {
          total: totalCount || 0,
          limit,
          offset,
          hasMore: offset + users.length < (totalCount || 0),
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GET-ADMIN-USERS] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});