import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeNumber(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return value;
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

    if (claimsError || !userId) {
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
    const settings = (body?.settings ?? {}) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    const defaultMonthlyFee = sanitizeNumber(settings.default_monthly_fee, 0, 100000);
    if (settings.default_monthly_fee !== undefined) {
      if (defaultMonthlyFee === null) {
        return json(400, { error: "default_monthly_fee inválido" });
      }
      updates.default_monthly_fee = defaultMonthlyFee;
    }

    const defaultProfitShare = sanitizeNumber(settings.default_profit_share_percent, 0, 100);
    if (settings.default_profit_share_percent !== undefined) {
      if (defaultProfitShare === null) {
        return json(400, { error: "default_profit_share_percent inválido" });
      }
      updates.default_profit_share_percent = defaultProfitShare;
    }

    const minTraderSplit = sanitizeNumber(settings.min_trader_split, 0, 100);
    if (settings.min_trader_split !== undefined) {
      if (minTraderSplit === null) {
        return json(400, { error: "min_trader_split inválido" });
      }
      updates.min_trader_split = minTraderSplit;
    }

    const maxTraderSplit = sanitizeNumber(settings.max_trader_split, 0, 100);
    if (settings.max_trader_split !== undefined) {
      if (maxTraderSplit === null) {
        return json(400, { error: "max_trader_split inválido" });
      }
      updates.max_trader_split = maxTraderSplit;
    }

    const defaultTraderSplit = sanitizeNumber(settings.default_trader_split, 0, 100);
    if (settings.default_trader_split !== undefined) {
      if (defaultTraderSplit === null) {
        return json(400, { error: "default_trader_split inválido" });
      }
      updates.default_trader_split = defaultTraderSplit;
      updates.default_platform_split = 100 - defaultTraderSplit;
    }

    if (Object.keys(updates).length === 0) {
      return json(400, { error: "Nenhuma alteração enviada" });
    }

    const { data: currentSettings, error: currentError } = await adminClient
      .from("copy_trade_settings")
      .select("*")
      .eq("id", SETTINGS_ID)
      .single();

    if (currentError || !currentSettings) {
      return json(404, { error: "Configuração não encontrada" });
    }

    const nextMin = (updates.min_trader_split as number | undefined) ?? currentSettings.min_trader_split;
    const nextMax = (updates.max_trader_split as number | undefined) ?? currentSettings.max_trader_split;
    const nextDefaultTrader = (updates.default_trader_split as number | undefined) ?? currentSettings.default_trader_split;

    if (nextMin > nextMax) {
      return json(400, { error: "Faixa mínima não pode ser maior que a máxima" });
    }

    if (nextDefaultTrader < nextMin || nextDefaultTrader > nextMax) {
      return json(400, { error: "default_trader_split fora da faixa permitida" });
    }

    updates.updated_by = userId;
    updates.updated_at = new Date().toISOString();

    const { data: updatedSettings, error: updateError } = await adminClient
      .from("copy_trade_settings")
      .update(updates)
      .eq("id", SETTINGS_ID)
      .select()
      .single();

    if (updateError) {
      console.error("manage-copy-trade-settings update error:", updateError);
      return json(500, { error: "Falha ao atualizar configurações" });
    }

    await adminClient.from("admin_audit_logs").insert({
      actor_user_id: userId,
      action: "copy_trade_settings_updated",
      entity: "copy_trade_settings",
      entity_id: SETTINGS_ID,
      before_data: currentSettings,
      after_data: updatedSettings,
      ip_address: req.headers.get("x-forwarded-for"),
    });

    return json(200, { success: true, settings: updatedSettings });
  } catch (error) {
    console.error("manage-copy-trade-settings error:", error);
    return json(500, { error: "Internal server error" });
  }
});
