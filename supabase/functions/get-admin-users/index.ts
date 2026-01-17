import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mask email for privacy: john.doe@gmail.com -> j***@gmail.com
function maskEmail(email: string | null): string {
  if (!email) return "N/A";
  const [localPart, domain] = email.split("@");
  if (!domain || localPart.length < 2) return "***@***";
  return `${localPart[0]}***@${domain}`;
}

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

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse query params for pagination/search
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Fetch wallets
    let walletsQuery = supabaseAdmin
      .from("wallets")
      .select("id, user_id, balance_available, balance_locked, currency, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

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
      .select("id, display_name, full_name, email")
      .in("id", userIds);

    const profilesMap = new Map<string, { display_name: string | null; full_name: string | null; email: string | null }>();
    (profilesData || []).forEach((p: any) => {
      profilesMap.set(p.id, {
        display_name: p.display_name,
        full_name: p.full_name,
        email: p.email,
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

    // Build response with masked emails and roles
    const users = (walletsData || [])
      .map((wallet: any) => {
        const profile = profilesMap.get(wallet.user_id);
        const displayName = profile?.display_name || profile?.full_name || "Sem nome";
        const email = profile?.email;
        const roles = rolesMap.get(wallet.user_id) || [];

        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          const matchesName = displayName.toLowerCase().includes(searchLower);
          const matchesEmail = email?.toLowerCase().includes(searchLower);
          const matchesId = wallet.user_id.toLowerCase().includes(searchLower);
          const matchesRole = roles.some(r => r.toLowerCase().includes(searchLower));
          if (!matchesName && !matchesEmail && !matchesId && !matchesRole) {
            return null;
          }
        }

        return {
          id: wallet.id,
          user_id: wallet.user_id,
          display_name: displayName,
          email_masked: maskEmail(email ?? null),
          balance_available: wallet.balance_available,
          balance_locked: wallet.balance_locked,
          currency: wallet.currency,
          created_at: wallet.created_at,
          updated_at: wallet.updated_at,
          roles: roles,
        };
      })
      .filter(Boolean);

    return new Response(
      JSON.stringify({ users }),
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
