import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStep, logError } from '../_shared/logging.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionName = 'get-admin-event';

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

    // Parse event ID from body or query
    let eventId: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        eventId = body.eventId;
      } catch {
        // ignore
      }
    } else {
      const url = new URL(req.url);
      eventId = url.searchParams.get('eventId');
    }

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep(functionName, 'Fetching event', { eventId });

    // Fetch event
    const { data: event, error: eventError } = await adminClient
      .from('markets')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      logError(functionName, 'Event not found', { error: eventError });
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch audit logs for this event
    const { data: auditLogs } = await adminClient
      .from('admin_audit_logs')
      .select('*')
      .eq('entity_id', eventId)
      .eq('entity', 'markets')
      .order('created_at', { ascending: false })
      .limit(50);

    logStep(functionName, 'Event fetched', { eventId, auditLogsCount: auditLogs?.length });

    return new Response(
      JSON.stringify({ event, auditLogs: auditLogs || [] }),
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
