import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFunctionLogger } from "../_shared/logging.ts";

const logger = createFunctionLogger("admin-warn-user");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WarnUserRequest {
  report_id: string;
  source: "market" | "suggestion";
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    logger.step("Starting admin-warn-user request");

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logger.step("No authorization header");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's auth token to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      logger.step("User not authenticated", { error: userError?.message });
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("User authenticated", { userId: user.id });

    // Create service role client for admin operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has admin role using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseService.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError) {
      logger.error("Error checking admin role", { error: roleError });
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isAdmin) {
      logger.step("User is not admin", { userId: user.id });
      return new Response(
        JSON.stringify({ error: "Acesso negado. Requer permissão de administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Admin role verified");

    // Parse request body
    const body: WarnUserRequest = await req.json();
    const { report_id, source } = body;

    if (!report_id || !source) {
      return new Response(
        JSON.stringify({ error: "report_id e source são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Request parsed", { report_id, source });

    // Get report and comment details based on source
    const tableName = source === "suggestion" ? "suggestion_comment_reports" : "comment_reports";
    const commentsTable = source === "suggestion" ? "suggestion_comments" : "comments";

    const { data: report, error: reportError } = await supabaseService
      .from(tableName)
      .select("comment_id, reason")
      .eq("id", report_id)
      .single();

    if (reportError || !report) {
      logger.error("Report not found", { report_id, error: reportError });
      return new Response(
        JSON.stringify({ error: "Denúncia não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Report found", { comment_id: report.comment_id, reason: report.reason });

    // Get comment details
    const { data: comment, error: commentError } = await supabaseService
      .from(commentsTable)
      .select("user_id, content")
      .eq("id", report.comment_id)
      .single();

    if (commentError || !comment) {
      logger.error("Comment not found", { comment_id: report.comment_id, error: commentError });
      return new Response(
        JSON.stringify({ error: "Comentário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Comment found", { userId: comment.user_id });

    // Get reason label for notification
    const reasonLabels: Record<string, string> = {
      spam: "Spam",
      offensive: "Conteúdo ofensivo",
      misinformation: "Desinformação",
      other: "Violação das regras",
    };
    const reasonLabel = reasonLabels[report.reason] || report.reason;
    const commentPreview = comment.content.slice(0, 50);
    const contextLabel = source === "suggestion" ? "sugestão" : "mercado";

    // Create notification using service role (bypasses RLS)
    const notificationData = {
      user_id: comment.user_id,
      type: "USER_WARNING",
      title: "Aviso sobre seu comentário",
      message: `Seu comentário foi sinalizado por: ${reasonLabel}. Por favor, revise as diretrizes da comunidade.`,
      data: {
        reason: report.reason,
        reason_label: reasonLabel,
        comment_preview: commentPreview,
        context: contextLabel,
        report_id: report_id,
      },
    };

    logger.step("Creating notification", { userId: comment.user_id, type: "USER_WARNING" });

    const { data: notification, error: notificationError } = await supabaseService
      .from("notifications")
      .insert(notificationData)
      .select("id")
      .single();

    if (notificationError) {
      logger.error("Error creating notification", { error: notificationError });
      return new Response(
        JSON.stringify({ error: "Erro ao criar notificação", details: notificationError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.step("Notification created", { notificationId: notification.id });

    // Optionally send email notification
    try {
      const emailPayload = {
        user_id: comment.user_id,
        type: "USER_WARNING",
        title: "Aviso sobre seu comentário",
        message: notificationData.message,
        notification_id: notification.id,
      };

      const emailResponse = await supabaseService.functions.invoke("send-notification-email", {
        body: emailPayload,
      });

      if (emailResponse.error) {
        logger.step("Email notification failed (non-critical)", { error: emailResponse.error });
      } else {
        logger.step("Email notification sent");
      }
    } catch (emailError) {
      // Email is non-critical, log but don't fail
      logger.step("Email notification error (non-critical)", { error: emailError });
    }

    const duration = performance.now() - startTime;
    logger.performance(duration, true, user.id, { report_id, source });

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: notification.id,
        warned_user_id: comment.user_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error("Unexpected error", { error });
    logger.performance(duration, false, undefined, { error: String(error) });

    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
