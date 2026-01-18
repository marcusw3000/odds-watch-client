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

  const functionName = 'create-admin-event';

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

    // Parse request body
    const body = await req.json();
    const {
      title,
      description,
      category,
      closeDate,
      imageUrl,
      tags,
      yesPrice,
      settlementType,
      resolution,
      cardStyle,
    } = body;

    logStep(functionName, 'Creating event', { title, category });

    // Validate required fields
    if (!title || !description || !category || !closeDate) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate initial prices
    const initialYesPrice = yesPrice ?? 0.5;
    const initialNoPrice = 1 - initialYesPrice;

    // Calculate initial LMSR shares based on b parameter
    const lmsrB = 100; // Default liquidity parameter
    const initialShares = lmsrB * Math.log(2); // Equal shares for 50/50

    // Insert event
    const { data: newEvent, error: insertError } = await adminClient
      .from('markets')
      .insert({
        title,
        description,
        category,
        status: 'OPEN',
        close_date: closeDate,
        image_url: imageUrl || null,
        tags: tags || [],
        current_yes_price: initialYesPrice,
        current_no_price: initialNoPrice,
        settlement_type: settlementType || 'MANUAL',
        resolution: resolution || null,
        card_style: cardStyle || 'default',
        lmsr_b: lmsrB,
        yes_shares: initialShares,
        no_shares: initialShares,
        total_volume: 0,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      logError(functionName, 'Insert failed', { error: insertError });
      return new Response(JSON.stringify({ error: 'Failed to create event' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch admin profile for audit log
    const { data: adminProfile } = await adminClient
      .from('profiles')
      .select('username, full_name')
      .eq('id', userId)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.username || 'Admin';

    // Log audit entry
    await adminClient.from('admin_audit_logs').insert({
      admin_id: userId,
      action: 'market_created',
      target_type: 'market',
      target_id: newEvent.id,
      details: {
        market_title: title,
        category,
        initial_yes_price: initialYesPrice,
        admin_name: adminName,
      },
    });

    logStep(functionName, 'Event created', { eventId: newEvent.id });

    return new Response(
      JSON.stringify({ success: true, event: newEvent }),
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
