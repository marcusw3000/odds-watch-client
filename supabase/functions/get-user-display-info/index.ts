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
    // This endpoint can be called without auth for public profiles
    // but requires auth to see non-public profiles
    const authHeader = req.headers.get("Authorization");
    let requestingUserId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supabase.auth.getClaims(token);
      requestingUserId = claimsData?.claims?.sub || null;
    }

    // Get user_id and context from query params
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("user_id");
    const context = url.searchParams.get("context"); // "comment" | "profile" | etc

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, is_public, bio")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileError) {
      console.error("[GET-USER-DISPLAY-INFO] Error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user info" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check visibility - own profile, public profiles, or comment context
    const isOwnProfile = requestingUserId === targetUserId;
    const isPublic = profile.is_public;
    // For comments, always show display name and avatar (user agreed to be identified when commenting publicly)
    const isCommentContext = context === "comment";

    if (!isOwnProfile && !isPublic && !isCommentContext) {
      // Return minimal info for private profiles
      return new Response(
        JSON.stringify({
          user_id: targetUserId,
          display_name: "Usuário",
          avatar_url: null,
          is_public: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return public profile info
    return new Response(
      JSON.stringify({
        user_id: profile.id,
        display_name: profile.display_name || "Usuário",
        avatar_url: profile.avatar_url,
        is_public: profile.is_public,
        bio: isOwnProfile || isPublic ? profile.bio : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[GET-USER-DISPLAY-INFO] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
