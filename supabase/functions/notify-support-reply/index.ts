import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifySupportReplyRequest {
  ticket_id: string;
  message_preview: string;
  action: "reply" | "resolved" | "closed";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: hasAdminRole } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { ticket_id, message_preview, action }: NotifySupportReplyRequest = await req.json();

    if (!ticket_id || !action) {
      return new Response(
        JSON.stringify({ error: "ticket_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing support notification: action=${action}, ticket=${ticket_id}`);

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject")
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error("Ticket not found:", ticketError);
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine notification type and message
    const isResolved = action === "resolved" || action === "closed";
    const notificationType = isResolved ? "SUPPORT_TICKET_RESOLVED" : "SUPPORT_REPLY";
    const notificationTitle = isResolved 
      ? "Ticket Resolvido ✅"
      : "Nova Resposta no Suporte 📩";
    const notificationMessage = isResolved
      ? `Seu ticket "${ticket.subject}" foi marcado como ${action === "resolved" ? "resolvido" : "fechado"}.`
      : `Nossa equipe respondeu ao seu ticket "${ticket.subject}".`;

    // Create notification for the user
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: ticket.user_id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        data: {
          ticket_id: ticket.id,
          subject: ticket.subject,
          message_preview: message_preview || null,
          action,
        },
      })
      .select("id")
      .single();

    if (notifError) {
      console.error("Error creating notification:", notifError);
      return new Response(
        JSON.stringify({ error: "Failed to create notification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notification created: ${notification.id}`);

    // Send email notification
    try {
      const emailResponse = await supabase.functions.invoke("send-notification-email", {
        body: {
          user_id: ticket.user_id,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          data: {
            notification_id: notification.id,
            ticket_id: ticket.id,
            subject: ticket.subject,
            message_preview: message_preview || null,
          },
        },
      });

      console.log("Email notification result:", emailResponse);
    } catch (emailError) {
      console.error("Error sending email notification:", emailError);
      // Don't fail the whole operation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
        type: notificationType,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-support-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
