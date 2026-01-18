import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      console.error('[get-admin-ledger] getClaims failed:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub as string;

    // Use service role for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse filters from body or query parameters
    let filters: {
      userId?: string;
      refType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      minAmount?: number;
      maxAmount?: number;
      limit?: number;
      offset?: number;
    } = {};

    // Try to get from body first (preferred), then fallback to query params
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        filters = body;
      } catch {
        // If body parsing fails, continue with empty filters
      }
    } else {
      const url = new URL(req.url);
      filters = {
        userId: url.searchParams.get('userId') || undefined,
        refType: url.searchParams.get('refType') || undefined,
        status: url.searchParams.get('status') || undefined,
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        minAmount: url.searchParams.get('minAmount') ? parseFloat(url.searchParams.get('minAmount')!) : undefined,
        maxAmount: url.searchParams.get('maxAmount') ? parseFloat(url.searchParams.get('maxAmount')!) : undefined,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 100,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
      };
    }

    // Build query
    let query = adminClient
      .from('ledger_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.refType && filters.refType !== 'all') {
      query = query.eq('ref_type', filters.refType);
    }
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.minAmount !== undefined) {
      query = query.gte('amount', filters.minAmount);
    }
    if (filters.maxAmount !== undefined) {
      query = query.lte('amount', filters.maxAmount);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data: entries, error: entriesError } = await query;

    if (entriesError) {
      console.error('Error fetching ledger entries:', entriesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch ledger entries' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mask user IDs for display (show first 8 characters)
    const maskedEntries = (entries || []).map(entry => ({
      ...entry,
      user_id_masked: entry.user_id ? `${entry.user_id.substring(0, 8)}...` : 'PLATFORM',
    }));

    console.log(`[get-admin-ledger] Admin ${userId} fetched ${maskedEntries.length} entries`);

    return new Response(JSON.stringify({ entries: maskedEntries }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-admin-ledger:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
