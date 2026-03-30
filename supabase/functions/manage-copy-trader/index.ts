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
    const action = body?.action as string | undefined;
    const traderId = body?.trader_id as string | undefined;

    if (!traderId || typeof traderId !== "string") {
      return json(400, { error: "trader_id inválido" });
    }

    const { data: currentTrader, error: currentTraderError } = await adminClient
      .from("copy_traders")
      .select("*")
      .eq("id", traderId)
      .single();

    if (currentTraderError || !currentTrader) {
      return json(404, { error: "Trader não encontrado" });
    }

    let updateData: Record<string, unknown> = {};
    let auditAction = "copy_trader_updated";

    const monthlyFee = body?.monthly_fee === undefined ? undefined : sanitizeNumber(body.monthly_fee, 0, 100000);
    const profitSharePercent = body?.profit_share_percent === undefined ? undefined : sanitizeNumber(body.profit_share_percent, 0, 100);
    const customTraderSplit = body?.custom_trader_split === undefined || body?.custom_trader_split === null
      ? body?.custom_trader_split
      : sanitizeNumber(body.custom_trader_split, 0, 100);

    if (body?.monthly_fee !== undefined && monthlyFee === null) {
      return json(400, { error: "monthly_fee inválido" });
    }

    if (body?.profit_share_percent !== undefined && profitSharePercent === null) {
      return json(400, { error: "profit_share_percent inválido" });
    }

    if (body?.custom_trader_split !== undefined && body?.custom_trader_split !== null && customTraderSplit === null) {
      return json(400, { error: "custom_trader_split inválido" });
    }

    switch (action) {
      case "approve":
        updateData = {
          status: "APPROVED",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
          suspended_at: null,
          ...(monthlyFee !== undefined ? { monthly_fee: monthlyFee } : {}),
          ...(profitSharePercent !== undefined ? { profit_share_percent: profitSharePercent } : {}),
          ...(body?.custom_trader_split !== undefined
            ? {
                custom_trader_split: customTraderSplit,
                custom_platform_split: customTraderSplit == null ? null : 100 - customTraderSplit,
              }
            : {}),
          updated_at: new Date().toISOString(),
        };
        auditAction = "copy_trader_approved";
        break;
      case "reject":
        if (typeof body?.rejection_reason !== "string" || body.rejection_reason.trim().length < 3) {
          return json(400, { error: "rejection_reason inválido" });
        }
        updateData = {
          status: "REJECTED",
          rejection_reason: body.rejection_reason.trim(),
          updated_at: new Date().toISOString(),
        };
        auditAction = "copy_trader_rejected";
        break;
      case "suspend":
        updateData = {
          status: "SUSPENDED",
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        auditAction = "copy_trader_suspended";
        break;
      case "unsuspend":
        updateData = {
          status: "APPROVED",
          suspended_at: null,
          updated_at: new Date().toISOString(),
        };
        auditAction = "copy_trader_unsuspended";
        break;
      case "update_settings":
        if (
          monthlyFee === undefined &&
          profitSharePercent === undefined &&
          body?.custom_trader_split === undefined
        ) {
          return json(400, { error: "Nenhuma alteração enviada" });
        }

        updateData = {
          ...(monthlyFee !== undefined ? { monthly_fee: monthlyFee } : {}),
          ...(profitSharePercent !== undefined ? { profit_share_percent: profitSharePercent } : {}),
          ...(body?.custom_trader_split !== undefined
            ? {
                custom_trader_split: customTraderSplit,
                custom_platform_split: customTraderSplit == null ? null : 100 - customTraderSplit,
              }
            : {}),
          updated_at: new Date().toISOString(),
        };
        auditAction = "copy_trader_settings_updated";
        break;
      default:
        return json(400, { error: "Ação inválida" });
    }

    const { data: updatedTrader, error: updateError } = await adminClient
      .from("copy_traders")
      .update(updateData)
      .eq("id", traderId)
      .select()
      .single();

    if (updateError) {
      console.error("manage-copy-trader update error:", updateError);
      return json(500, { error: "Falha ao atualizar trader" });
    }

    await adminClient.from("admin_audit_logs").insert({
      actor_user_id: userId,
      action: auditAction,
      entity: "copy_traders",
      entity_id: traderId,
      before_data: currentTrader,
      after_data: updatedTrader,
      ip_address: req.headers.get("x-forwarded-for"),
    });

    return json(200, updatedTrader);
  } catch (error) {
    console.error("manage-copy-trader error:", error);
    return json(500, { error: "Internal server error" });
  }
});
