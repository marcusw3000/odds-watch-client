import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("PAPER_COPY_CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!secret || request.headers.get("x-copy-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!serviceKey || !url || !resendKey) return new Response("Configuration unavailable", { status: 503 });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: tickets, error } = await db.rpc("claim_support_ticket_emails");
  if (error) {
    console.error("Could not claim support notifications", error);
    return new Response("Queue unavailable", { status: 503 });
  }

  let failures = 0;
  for (const ticket of tickets ?? []) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `support-ticket/${ticket.ticket_id}`,
        },
        body: JSON.stringify({
          from: "OrbMarket <notificacoes@orbmarket.com.br>",
          to: ["suporte@orbmarket.com.br"],
          subject: "Novo ticket de suporte",
          text: `Um novo ticket de suporte foi criado.\n\nAssunto: ${ticket.subject}\nIdentificador: ${ticket.ticket_id}\n\nAcesse o painel: https://orbmarket.com.br/admin/support`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);

      const { error: updateError } = await db.from("support_ticket_email_queue")
        .update({ sent_at: new Date().toISOString(), lease_id: null, lease_until: null, last_error: null })
        .eq("ticket_id", ticket.ticket_id).eq("lease_id", ticket.lease_id).is("sent_at", null);
      if (updateError) throw updateError;
    } catch (error) {
      failures++;
      console.error("Support notification failed", { ticketId: ticket.ticket_id, error: String(error) });
      await db.from("support_ticket_email_queue")
        .update({ next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(), lease_id: null, lease_until: null, last_error: String(error).slice(0, 300) })
        .eq("ticket_id", ticket.ticket_id).eq("lease_id", ticket.lease_id).is("sent_at", null);
    }
  }

  return Response.json({ processed: (tickets ?? []).length, failures }, { status: failures ? 503 : 200 });
});
