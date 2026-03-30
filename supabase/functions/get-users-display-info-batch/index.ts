import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function anonymizedProfiles(userIds: string[]) {
  return Object.fromEntries(
    userIds.map((userId) => [
      userId,
      {
        user_id: userId,
        display_name: "Usuário",
        avatar_url: null,
        is_public: false,
      },
    ]),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let userIds: string[] = [];
    let ticketId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((value): value is string => typeof value === "string") : [];
        ticketId = typeof body.ticket_id === "string" ? body.ticket_id : null;
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body", profiles: {} }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!userIds.length) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required", profiles: {} }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (userIds.length > 50) {
      userIds = userIds.slice(0, 50);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", profiles: anonymizedProfiles(userIds) }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: "ticket_id is required", profiles: anonymizedProfiles(userIds) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const requestingUserId = claimsData?.claims?.sub as string | undefined;

    if (claimsError || !requestingUserId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", profiles: anonymizedProfiles(userIds) }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: ticket }, { data: roleRows }] = await Promise.all([
      adminClient
        .from("support_tickets")
        .select("id, user_id")
        .eq("id", ticketId)
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", requestingUserId)
        .in("role", ["admin", "moderator"]),
    ]);

    const isStaff = (roleRows?.length ?? 0) > 0;
    const canAccessTicket = Boolean(ticket) && (ticket?.user_id === requestingUserId || isStaff);

    if (!canAccessTicket) {
      return new Response(
        JSON.stringify({ error: "Forbidden", profiles: anonymizedProfiles(userIds) }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const profilesMap = anonymizedProfiles(userIds);

    const { data: validSenders } = await adminClient
      .from("support_messages")
      .select("sender_id")
      .eq("ticket_id", ticketId)
      .in("sender_id", userIds);

    const allowedUserIds = [...new Set((validSenders || []).map((entry) => entry.sender_id))];

    if (!allowedUserIds.length) {
      return new Response(
        JSON.stringify({ profiles: profilesMap }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profiles, error: profileError } = await adminClient
      .from("profiles")
      .select("id, display_name, full_name, avatar_url, is_public")
      .in("id", allowedUserIds);

    if (profileError) {
      console.error("[GET-USERS-DISPLAY-INFO-BATCH] Error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user info", profiles: profilesMap }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const profile of profiles || []) {
      profilesMap[profile.id] = {
        user_id: profile.id,
        display_name: profile.display_name || profile.full_name || "Usuário",
        avatar_url: profile.avatar_url,
        is_public: profile.is_public,
      };
    }

    return new Response(
      JSON.stringify({ profiles: profilesMap }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[GET-USERS-DISPLAY-INFO-BATCH] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", profiles: {} }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
