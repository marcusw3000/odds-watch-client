import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TYPES = new Set(["DEPOSIT", "WITHDRAW", "TRADE", "SETTLEMENT"]);
const ALLOWED_MODES = new Set(["PERCENT", "FIXED", "TIERED"]);

interface FeeTierInput {
  min: number;
  max: number | null;
  percent: number;
}

interface FeeRulePayload {
  name?: string;
  type?: string;
  mode?: string;
  tiers?: FeeTierInput[];
  flat_value?: number | null;
  percent_value?: number | null;
  min_fee?: number | null;
  max_fee?: number | null;
  is_active?: boolean;
  effective_from?: string;
  created_by?: string | null;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < min || value > max) {
    return null;
  }

  return value;
}

function sanitizeTiers(value: unknown): FeeTierInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const tiers: FeeTierInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const min = sanitizeNumber((entry as Record<string, unknown>).min, 0, 1_000_000_000);
    const percent = sanitizeNumber((entry as Record<string, unknown>).percent, 0, 1);
    const rawMax = (entry as Record<string, unknown>).max;
    const max = rawMax === null ? null : sanitizeNumber(rawMax, 0, 1_000_000_000);

    if (min === null || percent === null || (rawMax !== null && max === null)) {
      return null;
    }

    if (max !== null && max < min) {
      return null;
    }

    tiers.push({ min, max, percent });
  }

  return tiers;
}

function sanitizeRuleInput(rule: FeeRulePayload, requireFullPayload: boolean) {
  const sanitized: Record<string, unknown> = {};

  if (rule.name !== undefined) {
    if (typeof rule.name !== "string" || rule.name.trim().length < 3 || rule.name.trim().length > 120) {
      return { error: "Nome da regra inválido" };
    }
    sanitized.name = rule.name.trim();
  } else if (requireFullPayload) {
    return { error: "Nome da regra é obrigatório" };
  }

  if (rule.type !== undefined) {
    if (typeof rule.type !== "string" || !ALLOWED_TYPES.has(rule.type)) {
      return { error: "Tipo de taxa inválido" };
    }
    sanitized.type = rule.type;
  } else if (requireFullPayload) {
    return { error: "Tipo de taxa é obrigatório" };
  }

  if (rule.mode !== undefined) {
    if (typeof rule.mode !== "string" || !ALLOWED_MODES.has(rule.mode)) {
      return { error: "Modo de taxa inválido" };
    }
    sanitized.mode = rule.mode;
  } else if (requireFullPayload) {
    return { error: "Modo de taxa é obrigatório" };
  }

  if (rule.tiers !== undefined) {
    const tiers = sanitizeTiers(rule.tiers);
    if (tiers === null) {
      return { error: "Faixas de taxa inválidas" };
    }
    sanitized.tiers = tiers;
  } else if (requireFullPayload) {
    sanitized.tiers = [];
  }

  const flatValue = rule.flat_value === undefined ? undefined : sanitizeNumber(rule.flat_value, 0, 1_000_000_000);
  if (rule.flat_value !== undefined && flatValue === null && rule.flat_value !== null) {
    return { error: "Valor fixo inválido" };
  }
  if (rule.flat_value !== undefined) {
    sanitized.flat_value = flatValue;
  }

  const percentValue = rule.percent_value === undefined ? undefined : sanitizeNumber(rule.percent_value, 0, 1);
  if (rule.percent_value !== undefined && percentValue === null && rule.percent_value !== null) {
    return { error: "Percentual inválido" };
  }
  if (rule.percent_value !== undefined) {
    sanitized.percent_value = percentValue;
  }

  const minFee = rule.min_fee === undefined ? undefined : sanitizeNumber(rule.min_fee, 0, 1_000_000_000);
  if (rule.min_fee !== undefined && minFee === null && rule.min_fee !== null) {
    return { error: "Taxa mínima inválida" };
  }
  if (rule.min_fee !== undefined) {
    sanitized.min_fee = minFee;
  }

  const maxFee = rule.max_fee === undefined ? undefined : sanitizeNumber(rule.max_fee, 0, 1_000_000_000);
  if (rule.max_fee !== undefined && maxFee === null && rule.max_fee !== null) {
    return { error: "Taxa máxima inválida" };
  }
  if (rule.max_fee !== undefined) {
    sanitized.max_fee = maxFee;
  }

  if (rule.is_active !== undefined) {
    if (typeof rule.is_active !== "boolean") {
      return { error: "Status da regra inválido" };
    }
    sanitized.is_active = rule.is_active;
  } else if (requireFullPayload) {
    sanitized.is_active = true;
  }

  if (rule.effective_from !== undefined) {
    if (typeof rule.effective_from !== "string" || Number.isNaN(Date.parse(rule.effective_from))) {
      return { error: "Data de vigência inválida" };
    }
    sanitized.effective_from = new Date(rule.effective_from).toISOString();
  } else if (requireFullPayload) {
    sanitized.effective_from = new Date().toISOString();
  }

  if (requireFullPayload && sanitized.mode === "TIERED" && !Array.isArray(sanitized.tiers)) {
    return { error: "Faixas são obrigatórias para taxa escalonada" };
  }

  return { data: sanitized };
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

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return json(403, { error: "Forbidden" });
    }

    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("username, full_name")
      .eq("id", userId)
      .maybeSingle();

    const adminName = adminProfile?.full_name || adminProfile?.username || "Admin";
    const ipAddress = req.headers.get("x-forwarded-for");
    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const payload = sanitizeRuleInput((body?.rule ?? {}) as FeeRulePayload, true);
      if ("error" in payload) {
        return json(400, { error: payload.error });
      }

      const insertData = {
        ...payload.data,
        created_by: userId,
      };

      const { data: rule, error } = await adminClient
        .from("fee_rules")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return json(500, { error: "Failed to create fee rule" });
      }

      await adminClient.from("admin_audit_logs").insert({
        actor_user_id: userId,
        action: "fee_rule_created",
        entity: "fee_rules",
        entity_id: rule.id,
        before_data: null,
        after_data: {
          ...rule,
          admin_name: adminName,
        },
        ip_address: ipAddress,
      });

      return json(200, { success: true, rule });
    }

    if (action === "update" || action === "deactivate") {
      const ruleId = body?.ruleId;
      if (typeof ruleId !== "string" || !isUuid(ruleId)) {
        return json(400, { error: "Fee rule ID inválido" });
      }

      const { data: existingRule, error: existingRuleError } = await adminClient
        .from("fee_rules")
        .select("*")
        .eq("id", ruleId)
        .single();

      if (existingRuleError || !existingRule) {
        return json(404, { error: "Fee rule not found" });
      }

      const payload = action === "deactivate"
        ? { data: { is_active: false } }
        : sanitizeRuleInput((body?.updates ?? {}) as FeeRulePayload, false);

      if ("error" in payload) {
        return json(400, { error: payload.error });
      }

      if (Object.keys(payload.data).length === 0) {
        return json(400, { error: "Nenhuma alteração enviada" });
      }

      const { data: rule, error } = await adminClient
        .from("fee_rules")
        .update(payload.data)
        .eq("id", ruleId)
        .select()
        .single();

      if (error) {
        return json(500, { error: "Failed to update fee rule" });
      }

      await adminClient.from("admin_audit_logs").insert({
        actor_user_id: userId,
        action: action === "deactivate" ? "fee_rule_deactivated" : "fee_rule_updated",
        entity: "fee_rules",
        entity_id: ruleId,
        before_data: existingRule,
        after_data: {
          ...rule,
          admin_name: adminName,
        },
        ip_address: ipAddress,
      });

      return json(200, { success: true, rule });
    }

    return json(400, { error: "Ação inválida" });
  } catch (error) {
    console.error("manage-fee-rules error:", error);
    return json(500, { error: "Internal server error" });
  }
});
