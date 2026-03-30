import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReportSource = "market" | "suggestion" | "chat";
type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED" | "ACTIONED";
type ReportAction = "none" | "hidden" | "deleted" | "user_warned";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSourceConfig(source: ReportSource) {
  if (source === "suggestion") {
    return {
      reportTable: "suggestion_comment_reports",
      contentTable: "suggestion_comments",
      referenceColumn: "comment_id",
      notificationContext: "sugest\u00e3o",
    };
  }

  if (source === "chat") {
    return {
      reportTable: "chat_reports",
      contentTable: "messages",
      referenceColumn: "message_id",
      notificationContext: "chat",
    };
  }

  return {
    reportTable: "comment_reports",
    contentTable: "comments",
    referenceColumn: "comment_id",
    notificationContext: "mercado",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;

    if (claimsError || !userId || !isUuid(userId)) {
      return json(401, { error: "Unauthorized" });
    }

    const { data: isAdmin } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!isAdmin) {
      return json(403, { error: "Forbidden" });
    }

    const body = await req.json();
    const reportId = body?.report_id as string | undefined;
    const status = body?.status as ReportStatus | undefined;
    const actionTaken = (body?.action_taken ?? "none") as ReportAction;
    const source = body?.source as ReportSource | undefined;

    if (!reportId || !isUuid(reportId)) {
      return json(400, { error: "report_id inv\u00e1lido" });
    }

    if (!source || !["market", "suggestion", "chat"].includes(source)) {
      return json(400, { error: "source inv\u00e1lido" });
    }

    if (!status || !["PENDING", "REVIEWED", "DISMISSED", "ACTIONED"].includes(status)) {
      return json(400, { error: "status inv\u00e1lido" });
    }

    if (!["none", "hidden", "deleted", "user_warned"].includes(actionTaken)) {
      return json(400, { error: "action_taken inv\u00e1lido" });
    }

    const config = getSourceConfig(source);

    const { data: currentReport, error: reportError } = await adminClient
      .from(config.reportTable)
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !currentReport) {
      return json(404, { error: "Den\u00fancia n\u00e3o encontrada" });
    }

    const updateData = {
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      action_taken: actionTaken,
    };

    const { data: updatedReport, error: updateError } = await adminClient
      .from(config.reportTable)
      .update(updateData)
      .eq("id", reportId)
      .select()
      .single();

    if (updateError || !updatedReport) {
      console.error("manage-comment-reports report update error:", updateError);
      return json(500, { error: "Falha ao atualizar den\u00fancia" });
    }

    const targetId = currentReport[config.referenceColumn] as string | undefined;
    let affectedContent: Record<string, unknown> | null = null;

    if (targetId && isUuid(targetId)) {
      const { data: currentContent } = await adminClient
        .from(config.contentTable)
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (currentContent) {
        affectedContent = currentContent as Record<string, unknown>;

        if (actionTaken === "hidden" && source !== "chat") {
          await adminClient
            .from(config.contentTable)
            .update({ is_hidden: true })
            .eq("id", targetId);
        } else if (actionTaken === "deleted") {
          await adminClient
            .from(config.contentTable)
            .delete()
            .eq("id", targetId);
        } else if (actionTaken === "user_warned") {
          const targetUserId = currentContent.user_id as string | undefined;
          const contentPreview = typeof currentContent.content === "string"
            ? currentContent.content.slice(0, 50)
            : "";

          if (targetUserId && isUuid(targetUserId)) {
            const notificationMessage = source === "chat"
              ? "Sua mensagem foi sinalizada. Revise as diretrizes da comunidade."
              : "Seu coment\u00e1rio foi sinalizado. Revise as diretrizes da comunidade.";

            await adminClient
              .from("notifications")
              .insert({
                user_id: targetUserId,
                type: "USER_WARNING",
                title: "Aviso de modera\u00e7\u00e3o",
                message: notificationMessage,
                data: {
                  source,
                  context: config.notificationContext,
                  report_id: reportId,
                  reason: currentReport.reason ?? null,
                  content_preview: contentPreview,
                },
              });
          }
        }
      }
    }

    await adminClient.from("admin_audit_logs").insert({
      actor_user_id: userId,
      action: `comment_report_${actionTaken}_${status}`.toLowerCase(),
      entity: config.reportTable,
      entity_id: reportId,
      before_data: currentReport,
      after_data: updatedReport,
      ip_address: req.headers.get("x-forwarded-for"),
    });

    if (affectedContent !== null) {
      await adminClient.from("admin_audit_logs").insert({
        actor_user_id: userId,
        action: `comment_content_${actionTaken}`.toLowerCase(),
        entity: config.contentTable,
        entity_id: targetId ?? null,
        before_data: affectedContent,
        after_data: actionTaken === "deleted"
          ? null
          : actionTaken === "hidden"
            ? { ...affectedContent, is_hidden: true }
            : affectedContent,
        ip_address: req.headers.get("x-forwarded-for"),
      });
    }

    return json(200, { success: true, report: updatedReport });
  } catch (error) {
    console.error("manage-comment-reports error:", error);
    return json(500, { error: "Internal server error" });
  }
});
