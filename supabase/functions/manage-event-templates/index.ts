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

function sanitizeString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return null;
  }

  return trimmed;
}

function sanitizeOptionalString(value: unknown, max: number): string | null | undefined {
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
  if (trimmed.length > max) {
    return undefined;
  }

  return trimmed;
}

function sanitizeTags(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const tags: string[] = [];

  for (const entry of value) {
    const tag = sanitizeString(entry, 1, 40);
    if (!tag) {
      return null;
    }

    tags.push(tag);
  }

  return Array.from(new Set(tags));
}

function sanitizeResolution(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
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

    if (action === "create") {
      const template = (body?.template ?? {}) as Record<string, unknown>;
      const name = sanitizeString(template.name, 3, 120);
      const category = sanitizeString(template.category, 2, 60);
      const titlePattern = sanitizeString(template.title_pattern, 3, 200);
      const description = sanitizeOptionalString(template.description, 2000);
      const cardStyle = sanitizeString(template.card_style ?? "default", 3, 50);
      const recurrenceType = sanitizeString(template.recurrence_type ?? "none", 2, 50);
      const tags = sanitizeTags(template.tags);
      const resolution = sanitizeResolution(template.resolution);

      if (!name) return json(400, { error: "name inv\u00e1lido" });
      if (!category) return json(400, { error: "category inv\u00e1lida" });
      if (!titlePattern) return json(400, { error: "title_pattern inv\u00e1lido" });
      if (description === undefined) return json(400, { error: "description inv\u00e1lida" });
      if (!cardStyle) return json(400, { error: "card_style inv\u00e1lido" });
      if (!recurrenceType) return json(400, { error: "recurrence_type inv\u00e1lido" });
      if (!tags) return json(400, { error: "tags inv\u00e1lidas" });
      if (template.resolution !== undefined && template.resolution !== null && !resolution) {
        return json(400, { error: "resolution inv\u00e1lida" });
      }

      const insertData = {
        name,
        category,
        title_pattern: titlePattern,
        description,
        resolution,
        card_style: cardStyle,
        recurrence_type: recurrenceType,
        tags,
        created_by: userId,
      };

      const { data: createdTemplate, error: createError } = await adminClient
        .from("event_templates")
        .insert(insertData)
        .select()
        .single();

      if (createError || !createdTemplate) {
        console.error("manage-event-templates create error:", createError);
        return json(500, { error: "Falha ao criar template" });
      }

      await adminClient.from("admin_audit_logs").insert({
        actor_user_id: userId,
        action: "event_template_created",
        entity: "event_templates",
        entity_id: createdTemplate.id,
        before_data: null,
        after_data: createdTemplate,
        ip_address: req.headers.get("x-forwarded-for"),
      });

      return json(200, { success: true, template: createdTemplate });
    }

    if (action === "delete") {
      const templateId = body?.templateId as string | undefined;
      if (!templateId || !isUuid(templateId)) {
        return json(400, { error: "templateId inv\u00e1lido" });
      }

      const { data: currentTemplate, error: currentError } = await adminClient
        .from("event_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (currentError || !currentTemplate) {
        return json(404, { error: "Template n\u00e3o encontrado" });
      }

      const { error: deleteError } = await adminClient
        .from("event_templates")
        .delete()
        .eq("id", templateId);

      if (deleteError) {
        console.error("manage-event-templates delete error:", deleteError);
        return json(500, { error: "Falha ao excluir template" });
      }

      await adminClient.from("admin_audit_logs").insert({
        actor_user_id: userId,
        action: "event_template_deleted",
        entity: "event_templates",
        entity_id: templateId,
        before_data: currentTemplate,
        after_data: null,
        ip_address: req.headers.get("x-forwarded-for"),
      });

      return json(200, { success: true });
    }

    return json(400, { error: "A\u00e7\u00e3o inv\u00e1lida" });
  } catch (error) {
    console.error("manage-event-templates error:", error);
    return json(500, { error: "Internal server error" });
  }
});
