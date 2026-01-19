import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub as string;

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
      return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { marketId, winningOutcome } = body;

    if (!marketId || !winningOutcome) {
      return new Response(JSON.stringify({ error: 'marketId and winningOutcome required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing payouts for market:', marketId, 'outcome:', winningOutcome);

    // Process payouts
    const { data: payoutResult, error: payoutError } = await adminClient.rpc(
      'process_market_payouts',
      { p_market_id: marketId, p_winning_outcome: winningOutcome }
    );

    if (payoutError) {
      console.error('Payout error:', payoutError);
    } else {
      console.log('Payout result:', payoutResult);
    }

    // Process copy trade commissions
    const { data: commissionResult, error: commissionError } = await adminClient.rpc(
      'process_copy_trade_commissions',
      { p_market_id: marketId, p_winning_outcome: winningOutcome }
    );

    if (commissionError) {
      console.error('Commission error:', commissionError);
    } else {
      console.log('Commission result:', commissionResult);
    }

    // Process achievements
    const { error: achievementError } = await adminClient.rpc(
      'process_market_settlement_achievements',
      { p_market_id: marketId, p_winning_outcome: winningOutcome }
    );

    if (achievementError) {
      console.error('Achievement error:', achievementError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payouts: payoutResult,
        payoutError: payoutError?.message,
        commissions: commissionResult,
        commissionError: commissionError?.message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
