import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function anonymizedProfile(userId: string | null) {
  return {
    user_id: userId,
    display_name: "Usuário",
    avatar_url: null,
    is_public: false,
    bio: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    let requestingUserId: string | null = null;
    let isStaff = false;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await userClient.auth.getClaims(token);
      requestingUserId = (claimsData?.claims?.sub as string | undefined) ?? null;

      if (requestingUserId) {
        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", requestingUserId)
          .in("role", ["admin", "moderator"]);

        isStaff = (roleRows?.length ?? 0) > 0;
      }
    }

    const url = new URL(req.url);
    let targetUserId = url.searchParams.get("user_id");
    let commentId = url.searchParams.get("comment_id");

    if (!targetUserId && req.method === "POST") {
      try {
        const body = await req.json();
        targetUserId = typeof body.user_id === "string" ? body.user_id : null;
        commentId = typeof body.comment_id === "string" ? body.comment_id : commentId;
      } catch {
        return new Response(
          JSON.stringify(anonymizedProfile(targetUserId)),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name, avatar_url, is_public, bio")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profileError) {
      console.error("[GET-USER-DISPLAY-INFO] Error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user info" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify(anonymizedProfile(targetUserId)),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isOwnProfile = requestingUserId === targetUserId;
    const isPublic = profile.is_public;
    let canUseCommentProof = false;

    if (!isOwnProfile && !isPublic && !isStaff && commentId) {
      const { data: visibleComment } = await supabaseAdmin
        .from("comments")
        .select("id")
        .eq("id", commentId)
        .eq("user_id", targetUserId)
        .eq("is_hidden", false)
        .maybeSingle();

      canUseCommentProof = Boolean(visibleComment);
    }

    if (!isOwnProfile && !isPublic && !isStaff && !canUseCommentProof) {
      return new Response(
        JSON.stringify(anonymizedProfile(targetUserId)),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        user_id: profile.id,
        display_name: profile.display_name || profile.full_name || "Usuário",
        avatar_url: profile.avatar_url,
        is_public: profile.is_public,
        bio: isOwnProfile || isPublic || isStaff ? profile.bio : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[GET-USER-DISPLAY-INFO] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
