import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeOptionalNotes(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length > 2000) {
    return undefined;
  }

  return trimmed;
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
    const action = body?.action as string | undefined;
    const suggestionId = body?.suggestionId as string | undefined;

    if (!suggestionId || !isUuid(suggestionId)) {
      return json(400, { error: "suggestionId inv\u00e1lido" });
    }

    const { data: currentSuggestion, error: currentError } = await adminClient
      .from("market_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (currentError || !currentSuggestion) {
      return json(404, { error: "Sugest\u00e3o n\u00e3o encontrada" });
    }

    let updates: Record<string, unknown>;
    let auditAction: string;

    if (action === "review") {
      const status = body?.review?.status as string | undefined;
      const adminNotes = sanitizeOptionalNotes(body?.review?.admin_notes);

      if (status !== "APPROVED" && status !== "REJECTED") {
        return json(400, { error: "status inv\u00e1lido" });
      }

      if (adminNotes === undefined) {
        return json(400, { error: "admin_notes inv\u00e1lido" });
      }

      if (status === "REJECTED" && (!adminNotes || adminNotes.length < 3)) {
        return json(400, { error: "admin_notes \u00e9 obrigat\u00f3rio para rejei\u00e7\u00e3o" });
      }

      updates = {
        status,
        admin_notes: adminNotes,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      auditAction = status === "APPROVED" ? "market_suggestion_approved" : "market_suggestion_rejected";
    } else if (action === "implement") {
      const marketId = body?.marketId as string | undefined;
      if (!marketId || !isUuid(marketId)) {
        return json(400, { error: "marketId inv\u00e1lido" });
      }

      updates = {
        status: "IMPLEMENTED",
        market_id: marketId,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      auditAction = "market_suggestion_implemented";
    } else {
      return json(400, { error: "A\u00e7\u00e3o inv\u00e1lida" });
    }

    const { data: updatedSuggestion, error: updateError } = await adminClient
      .from("market_suggestions")
      .update(updates)
      .eq("id", suggestionId)
      .select()
      .single();

    if (updateError || !updatedSuggestion) {
      console.error("manage-market-suggestions update error:", updateError);
      return json(500, { error: "Falha ao atualizar sugest\u00e3o" });
    }

    await adminClient.from("admin_audit_logs").insert({
      actor_user_id: userId,
      action: auditAction,
      entity: "market_suggestions",
      entity_id: suggestionId,
      before_data: currentSuggestion,
      after_data: updatedSuggestion,
      ip_address: req.headers.get("x-forwarded-for"),
    });

    return json(200, { success: true, suggestion: updatedSuggestion });
  } catch (error) {
    console.error("manage-market-suggestions error:", error);
    return json(500, { error: "Internal server error" });
  }
});
