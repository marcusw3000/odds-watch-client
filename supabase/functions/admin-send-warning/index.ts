import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createFunctionLogger, logPerformance } from "../_shared/logging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendWarningRequest {
  user_id: string;
  message: string;
  category?: "warning" | "reminder" | "alert";
  send_email?: boolean;
}

serve(async (req) => {
  const startTime = performance.now();
  const logger = createFunctionLogger("admin-send-warning");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.step("Starting admin-send-warning request");

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

    // Parse request body
    const { user_id, message, category = "warning", send_email = false }: SendWarningRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target user exists
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Target user found", { user_id, display_name: targetProfile.display_name });

    // Determine notification type and title based on category
    const categoryConfig = {
      warning: { type: "ADMIN_WARNING", title: "⚠️ Aviso da Administração" },
      reminder: { type: "ADMIN_REMINDER", title: "📌 Lembrete da Administração" },
      alert: { type: "ADMIN_ALERT", title: "🚨 Alerta da Administração" },
    };

    const config = categoryConfig[category] || categoryConfig.warning;

    // Create notification
    const { data: notification, error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: user_id,
        type: config.type,
        title: config.title,
        message: message.trim(),
        data: {
          category,
          sent_by: actorUserId,
        },
      })
      .select("id")
      .single();

    if (notifError) {
      logger.error("Failed to create notification", { error: notifError });
      return new Response(
        JSON.stringify({ error: "Failed to send warning" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Notification created", { notification_id: notification.id });

    // Log to audit
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_user_id: actorUserId,
        action_type: "WARNING_SENT",
        target_user_id: user_id,
        details: {
          message: message.trim(),
          category,
          notification_id: notification.id,
          user_display_name: targetProfile.display_name,
        },
      });

    if (auditError) {
      logger.error("Failed to log audit", { error: auditError });
    }

    // Optionally send email
    if (send_email && targetProfile.email) {
      try {
        await supabaseAdmin.functions.invoke("send-notification-email", {
          body: {
            user_id: user_id,
            notification_type: config.type,
            notification_id: notification.id,
            data: {
              title: config.title,
              message: message.trim(),
            },
          },
        });
        logger.step("Email notification sent");
      } catch (emailError) {
        logger.error("Failed to send email", { error: emailError });
        // Continue - email failure shouldn't block the action
      }
    }

    logPerformance({
      functionName: "admin-send-warning",
      duration: performance.now() - startTime,
      userId: actorUserId,
      success: true,
      metadata: { category, targetUserId: user_id },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: notification.id,
        message: "Aviso enviado com sucesso" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Unexpected error", { error });

    logPerformance({
      functionName: "admin-send-warning",
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
