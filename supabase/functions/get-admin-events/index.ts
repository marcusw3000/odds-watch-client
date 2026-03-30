import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStep, logError } from '../_shared/logging.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizeSearchTerm(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = 'get-admin-events';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify user with their token
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      logError(functionName, 'getClaims failed', { error: claimsError });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub as string;
    logStep(functionName, 'User authenticated', { userId });

    // Use service role client for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify admin role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      logStep(functionName, 'Not an admin', { userId });
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse filters from body or query params
    let filters: Record<string, unknown> = {};
    
    if (req.method === 'POST') {
      try {
        filters = await req.json();
      } catch {
        filters = {};
      }
    } else {
      const url = new URL(req.url);
      filters = {
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined,
        category: url.searchParams.get('category') || undefined,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 25,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
      };
    }

    const {
      search,
      status,
      category,
      limit = 25,
      offset = 0,
    } = filters;

    logStep(functionName, 'Fetching events', { search, status, category, limit, offset });

    // Build query
    let query = adminClient
      .from('markets')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    const sanitizedSearch = sanitizeSearchTerm(search);

    if (sanitizedSearch) {
      query = query.or(`title.ilike.%${sanitizedSearch}%,category.ilike.%${sanitizedSearch}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Apply pagination
    query = query.range(offset as number, (offset as number) + (limit as number) - 1);

    const { data: events, error: eventsError, count } = await query;

    if (eventsError) {
      logError(functionName, 'Query failed', { error: eventsError });
      return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep(functionName, 'Events fetched', { count, returned: events?.length });

    return new Response(
      JSON.stringify({ 
        events: events || [], 
        totalCount: count || 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logError(functionName, error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
