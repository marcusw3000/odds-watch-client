import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let userIds: string[] = [];
    let context: string | null = null;

    // Parse body for POST requests
    if (req.method === "POST") {
      try {
        const body = await req.json();
        userIds = body.user_ids || [];
        context = body.context || null;
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (!userIds.length) {
      return new Response(
        JSON.stringify({ error: "user_ids array is required", profiles: {} }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 50 users per request
    if (userIds.length > 50) {
      userIds = userIds.slice(0, 50);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all profiles in one query
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name, avatar_url, is_public")
      .in("id", userIds);

    if (profileError) {
      console.error("[GET-USERS-DISPLAY-INFO-BATCH] Error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user info", profiles: {} }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build response map
    const profilesMap: Record<string, {
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      is_public: boolean;
    }> = {};

    // For support/comment contexts, always show basic info
    const isAllowedContext = context === "comment" || context === "support";

    for (const profile of profiles || []) {
      const isPublic = profile.is_public;
      
      if (isPublic || isAllowedContext) {
        profilesMap[profile.id] = {
          user_id: profile.id,
          display_name: profile.display_name || profile.full_name || "Usuário",
          avatar_url: profile.avatar_url,
          is_public: profile.is_public,
        };
      } else {
        // Return minimal info for private profiles
        profilesMap[profile.id] = {
          user_id: profile.id,
          display_name: "Usuário",
          avatar_url: null,
          is_public: false,
        };
      }
    }

    // Add fallback for any requested IDs that weren't found
    for (const userId of userIds) {
      if (!profilesMap[userId]) {
        profilesMap[userId] = {
          user_id: userId,
          display_name: "Usuário",
          avatar_url: null,
          is_public: false,
        };
      }
    }

    return new Response(
      JSON.stringify({ profiles: profilesMap }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GET-USERS-DISPLAY-INFO-BATCH] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", profiles: {} }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
