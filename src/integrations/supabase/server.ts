import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "react-router";
import { parse, serialize } from "cookie";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./types";

type ServerSupabaseClient = SupabaseClient<Database>;

interface ServerAuthState {
  headers: Headers;
  isAdmin: boolean;
  supabase: ServerSupabaseClient;
  user: User | null;
}

function appendResponseHeaders(target: Headers, source: Record<string, string>) {
  for (const [key, value] of Object.entries(source)) {
    target.set(key, value);
  }
}

function appendSetCookie(
  headers: Headers,
  name: string,
  value: string,
  options: Parameters<typeof serialize>[2],
) {
  headers.append(
    "Set-Cookie",
    serialize(name, value, {
      path: "/",
      sameSite: "lax",
      ...options,
    }),
  );
}

export function createRequestSupabaseClient(
  request: Request,
  responseHeaders = new Headers(),
) {
  const cookieStore = parse(request.headers.get("Cookie") ?? "");

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
      },
      cookies: {
        getAll() {
          return Object.entries(cookieStore).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet, headers) {
          appendResponseHeaders(responseHeaders, headers);

          for (const { name, options, value } of cookiesToSet) {
            cookieStore[name] = value;
            appendSetCookie(responseHeaders, name, value, options);
          }
        },
      },
    },
  );

  return {
    headers: responseHeaders,
    supabase,
  };
}

async function resolveAdminRole(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _role: "admin",
    _user_id: userId,
  });

  if (error) {
    console.error("[SSR Auth] Failed to resolve admin role:", error);
    return false;
  }

  return data === true;
}

export async function getServerAuthState(
  request: Request,
): Promise<ServerAuthState> {
  const { headers, supabase } = createRequestSupabaseClient(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      headers,
      isAdmin: false,
      supabase,
      user: null,
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[SSR Auth] Failed to resolve user:", error);
  }

  const verifiedUser = user ?? null;
  const isAdmin = verifiedUser
    ? await resolveAdminRole(supabase, verifiedUser.id)
    : false;

  return {
    headers,
    isAdmin,
    supabase,
    user: verifiedUser,
  };
}

function buildAuthRedirectTarget(request: Request) {
  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;

  return `/auth?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function requireAuthenticatedUser(request: Request) {
  const auth = await getServerAuthState(request);

  if (!auth.user) {
    throw redirect(buildAuthRedirectTarget(request), {
      headers: auth.headers,
    });
  }

  return auth;
}

export async function requireAdminUser(request: Request) {
  const auth = await getServerAuthState(request);

  if (!auth.user || !auth.isAdmin) {
    throw redirect("/admin/login", {
      headers: auth.headers,
    });
  }

  return auth;
}
