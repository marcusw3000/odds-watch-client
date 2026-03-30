import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const staffRoles = new Set(["admin", "moderator"]);
const validStatuses = new Set(["open", "in_progress", "waiting_customer", "resolved", "closed"]);
const validPriorities = new Set(["low", "medium", "high", "urgent"]);

type SupportStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
type SupportPriority = "low" | "medium" | "high" | "urgent";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 5000) {
    return null;
  }

  return trimmed;
}

function parseStatus(value: unknown): SupportStatus | null {
  return typeof value === "string" && validStatuses.has(value) ? (value as SupportStatus) : null;
}

function parsePriority(value: unknown): SupportPriority | null {
  return typeof value === "string" && validPriorities.has(value) ? (value as SupportPriority) : null;
}

async function notifyUser(
  adminClient: ReturnType<typeof createClient>,
  ticket: { id: string; user_id: string; subject: string },
  action: "reply" | "resolved" | "closed",
  messagePreview: string | null,
) {
  const isResolved = action === "resolved" || action === "closed";
  const notificationType = isResolved ? "SUPPORT_TICKET_RESOLVED" : "SUPPORT_REPLY";
  const notificationTitle = isResolved ? "Ticket Resolvido" : "Nova Resposta no Suporte";
  const notificationMessage = isResolved
    ? `Seu ticket "${ticket.subject}" foi marcado como ${action === "resolved" ? "resolvido" : "fechado"}.`
    : `Nossa equipe respondeu ao seu ticket "${ticket.subject}".`;

  const { data: notification, error: notificationError } = await adminClient
    .from("notifications")
    .insert({
      user_id: ticket.user_id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      data: {
        ticket_id: ticket.id,
        subject: ticket.subject,
        message_preview: messagePreview,
        action,
      },
    })
    .select("id")
    .single();

  if (notificationError || !notification) {
    console.error("manage-support-tickets notification error:", notificationError);
    return;
  }

  try {
    await adminClient.functions.invoke("send-notification-email", {
      body: {
        user_id: ticket.user_id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        data: {
          notification_id: notification.id,
          ticket_id: ticket.id,
          subject: ticket.subject,
          message_preview: messagePreview,
        },
      },
    });
  } catch (emailError) {
    console.error("manage-support-tickets email error:", emailError);
  }
}

async function writeAuditLog(
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  actorUserId: string,
  action: string,
  entity: string,
  entityId: string,
  beforeData: unknown,
  afterData: unknown,
) {
  await adminClient.from("admin_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity,
    entity_id: entityId,
    before_data: beforeData,
    after_data: afterData,
    ip_address: req.headers.get("x-forwarded-for"),
  });
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

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : "";

    if (!ticketId || !isUuid(ticketId)) {
      return json(400, { error: "ticketId invalido" });
    }

    const { data: currentTicket, error: ticketError } = await adminClient
      .from("support_tickets")
      .select("id, user_id, subject, status, priority, assigned_to, closed_at")
      .eq("id", ticketId)
      .single();

    if (ticketError || !currentTicket) {
      return json(404, { error: "Ticket nao encontrado" });
    }

    const { data: roleRows, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error("manage-support-tickets role lookup error:", rolesError);
      return json(500, { error: "Falha ao validar permissao" });
    }

    const isStaff = (roleRows ?? []).some((row) => staffRoles.has(row.role));
    const isOwner = currentTicket.user_id === userId;

    if (action === "send_user_message") {
      const message = sanitizeMessage(body?.message);

      if (!isOwner) {
        return json(403, { error: "Forbidden" });
      }

      if (!message) {
        return json(400, { error: "message invalida" });
      }

      if (currentTicket.status === "closed" || currentTicket.status === "resolved") {
        return json(400, { error: "Ticket encerrado" });
      }

      const { data: supportMessage, error: messageError } = await adminClient
        .from("support_messages")
        .insert({
          ticket_id: ticketId,
          sender_id: userId,
          message,
          is_staff: false,
        })
        .select()
        .single();

      if (messageError || !supportMessage) {
        console.error("manage-support-tickets send_user_message insert error:", messageError);
        return json(500, { error: "Falha ao enviar mensagem" });
      }

      if (currentTicket.status === "waiting_customer") {
        const { error: ticketUpdateError } = await adminClient
          .from("support_tickets")
          .update({ status: "in_progress", closed_at: null })
          .eq("id", ticketId);

        if (ticketUpdateError) {
          console.error("manage-support-tickets send_user_message update error:", ticketUpdateError);
          return json(500, { error: "Falha ao atualizar ticket" });
        }
      }

      return json(200, { success: true, message: supportMessage });
    }

    if (!isStaff) {
      return json(403, { error: "Forbidden" });
    }

    if (action === "assign") {
      const assignedTo = body?.assignedTo;
      if (assignedTo !== null && assignedTo !== undefined && (typeof assignedTo !== "string" || !isUuid(assignedTo))) {
        return json(400, { error: "assignedTo invalido" });
      }

      const updates = {
        assigned_to: assignedTo ?? null,
        status: assignedTo ? "in_progress" : "open",
        closed_at: null,
      };

      const { data: updatedTicket, error: updateError } = await adminClient
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId)
        .select("id, user_id, subject, status, priority, assigned_to, closed_at")
        .single();

      if (updateError || !updatedTicket) {
        console.error("manage-support-tickets assign error:", updateError);
        return json(500, { error: "Falha ao atribuir ticket" });
      }

      await writeAuditLog(
        adminClient,
        req,
        userId,
        "support_ticket_assigned",
        "support_tickets",
        ticketId,
        currentTicket,
        updatedTicket,
      );

      return json(200, { success: true, ticket: updatedTicket });
    }

    if (action === "update_status") {
      const status = parseStatus(body?.status);
      if (!status) {
        return json(400, { error: "status invalido" });
      }

      const updates = {
        status,
        closed_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
      };

      const { data: updatedTicket, error: updateError } = await adminClient
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketId)
        .select("id, user_id, subject, status, priority, assigned_to, closed_at")
        .single();

      if (updateError || !updatedTicket) {
        console.error("manage-support-tickets update_status error:", updateError);
        return json(500, { error: "Falha ao atualizar status" });
      }

      await writeAuditLog(
        adminClient,
        req,
        userId,
        `support_ticket_status_${status}`,
        "support_tickets",
        ticketId,
        currentTicket,
        updatedTicket,
      );

      if (status === "resolved" || status === "closed") {
        await notifyUser(adminClient, currentTicket, status, null);
      }

      return json(200, { success: true, ticket: updatedTicket });
    }

    if (action === "update_priority") {
      const priority = parsePriority(body?.priority);
      if (!priority) {
        return json(400, { error: "priority invalida" });
      }

      const { data: updatedTicket, error: updateError } = await adminClient
        .from("support_tickets")
        .update({ priority })
        .eq("id", ticketId)
        .select("id, user_id, subject, status, priority, assigned_to, closed_at")
        .single();

      if (updateError || !updatedTicket) {
        console.error("manage-support-tickets update_priority error:", updateError);
        return json(500, { error: "Falha ao atualizar prioridade" });
      }

      await writeAuditLog(
        adminClient,
        req,
        userId,
        "support_ticket_priority_updated",
        "support_tickets",
        ticketId,
        currentTicket,
        updatedTicket,
      );

      return json(200, { success: true, ticket: updatedTicket });
    }

    if (action === "send_staff_message") {
      const message = sanitizeMessage(body?.message);
      if (!message) {
        return json(400, { error: "message invalida" });
      }

      const { data: supportMessage, error: messageError } = await adminClient
        .from("support_messages")
        .insert({
          ticket_id: ticketId,
          sender_id: userId,
          message,
          is_staff: true,
        })
        .select()
        .single();

      if (messageError || !supportMessage) {
        console.error("manage-support-tickets send_staff_message insert error:", messageError);
        return json(500, { error: "Falha ao enviar mensagem da equipe" });
      }

      const { data: updatedTicket, error: ticketUpdateError } = await adminClient
        .from("support_tickets")
        .update({ status: "waiting_customer", closed_at: null })
        .eq("id", ticketId)
        .select("id, user_id, subject, status, priority, assigned_to, closed_at")
        .single();

      if (ticketUpdateError || !updatedTicket) {
        console.error("manage-support-tickets send_staff_message update error:", ticketUpdateError);
        return json(500, { error: "Falha ao atualizar ticket" });
      }

      await writeAuditLog(
        adminClient,
        req,
        userId,
        "support_ticket_staff_replied",
        "support_tickets",
        ticketId,
        currentTicket,
        updatedTicket,
      );

      const messagePreview = message.length > 100 ? message.slice(0, 100) : message;
      await notifyUser(adminClient, currentTicket, "reply", messagePreview);

      return json(200, { success: true, message: supportMessage, ticket: updatedTicket });
    }

    return json(400, { error: "Acao invalida" });
  } catch (error) {
    console.error("manage-support-tickets error:", error);
    return json(500, { error: "Internal server error" });
  }
});
