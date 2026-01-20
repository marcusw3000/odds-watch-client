import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createFunctionLogger, logPerformance } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BlockUserRequest {
  user_id: string;
  action: "block" | "unblock";
  reason?: string;
}

serve(async (req) => {
  const startTime = performance.now();
  const logger = createFunctionLogger("block-user");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.step("Starting block-user request");

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user token for auth
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

    // Parse request body
    const { user_id, action, reason }: BlockUserRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!action || !["block", "unblock"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'block' or 'unblock'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-blocking
    if (user_id === actorUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot block/unblock yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target user exists
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, is_blocked")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Target user found", { user_id, current_blocked: targetProfile.is_blocked });

    // Update profile
    const updateData = action === "block" 
      ? {
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason || null,
          blocked_by: actorUserId,
        }
      : {
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
          blocked_by: null,
        };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", user_id);

    if (updateError) {
      logger.error("Failed to update profile", { error: updateError });
      return new Response(
        JSON.stringify({ error: "Failed to update user status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Profile updated", { action });

    // Log to audit
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_user_id: actorUserId,
        action_type: action === "block" ? "USER_BLOCKED" : "USER_UNBLOCKED",
        target_user_id: user_id,
        details: {
          reason: reason || null,
          previous_blocked: targetProfile.is_blocked,
          user_display_name: targetProfile.display_name,
        },
      });

    if (auditError) {
      logger.error("Failed to log audit", { error: auditError });
      // Continue - audit failure shouldn't block the action
    }

    // Create notification for the user
    if (action === "block") {
      await supabaseAdmin.from("notifications").insert({
        user_id: user_id,
        type: "USER_BLOCKED",
        title: "Conta bloqueada",
        message: reason 
          ? `Sua conta foi bloqueada. Motivo: ${reason}`
          : "Sua conta foi bloqueada. Entre em contato com o suporte para mais informações.",
        data: { reason },
      });
    } else {
      await supabaseAdmin.from("notifications").insert({
        user_id: user_id,
        type: "USER_UNBLOCKED",
        title: "Conta desbloqueada",
        message: "Sua conta foi desbloqueada. Você pode voltar a usar a plataforma normalmente.",
        data: {},
      });
    }

    logger.step("Notification created");

    logPerformance({
      functionName: "block-user",
      duration: performance.now() - startTime,
      userId: actorUserId,
      success: true,
      metadata: { action, targetUserId: user_id },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: action === "block" ? "Usuário bloqueado" : "Usuário desbloqueado" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Unexpected error", { error });

    logPerformance({
      functionName: "block-user",
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
