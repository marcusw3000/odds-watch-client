import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "admin" | "moderator" | "user";

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
      console.error("[MANAGE-USER-ROLES] Claims error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actorUserId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if actor is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.error("[MANAGE-USER-ROLES] User is not admin:", actorUserId);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { user_id, action, role } = body as { 
      user_id: string; 
      action: "add" | "remove"; 
      role: AppRole;
    };

    // Validate inputs
    if (!user_id || !action || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, action, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["add", "remove"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'add' or 'remove'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "moderator", "user"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be 'admin', 'moderator', or 'user'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Protection: Cannot remove own admin role
    if (action === "remove" && role === "admin" && user_id === actorUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot remove your own admin role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target user exists
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name")
      .eq("id", user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { success: boolean; message: string };

    if (action === "add") {
      // Add role (upsert to handle duplicate)
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id, role },
          { onConflict: "user_id,role" }
        );

      if (insertError) {
        console.error("[MANAGE-USER-ROLES] Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to add role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      result = { success: true, message: `Role '${role}' added to user` };
    } else {
      // Remove role
      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", role);

      if (deleteError) {
        console.error("[MANAGE-USER-ROLES] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to remove role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      result = { success: true, message: `Role '${role}' removed from user` };
    }

    // Log the action to audit
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        actor_id: actorUserId,
        action: action === "add" ? "ROLE_ASSIGNED" : "ROLE_REMOVED",
        entity_type: "USER_ROLE",
        entity_id: user_id,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
        data_before: action === "remove" ? { role } : null,
        data_after: action === "add" ? { role } : null,
      });

    if (auditError) {
      console.error("[MANAGE-USER-ROLES] Audit log error:", auditError);
      // Don't fail the request, just log the error
    }

    console.log(`[MANAGE-USER-ROLES] ${action.toUpperCase()} role '${role}' for user ${user_id} by admin ${actorUserId}`);

    // Fetch updated roles for the user
    const { data: updatedRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);

    return new Response(
      JSON.stringify({ 
        ...result, 
        roles: (updatedRoles || []).map((r: { role: string }) => r.role)
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[MANAGE-USER-ROLES] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
