import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body for format
    let format = 'json';
    try {
      const body = await req.json();
      format = body.format || 'json';
    } catch {
      // Default to json if no body
    }

    // Create service client for fetching data
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[export-user-data] Exporting data for user ${user.id} in ${format} format`);

    // Check rate limit (1 export per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentExports, error: rateLimitError } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('action', 'DATA_EXPORT')
      .gte('created_at', oneHourAgo)
      .limit(1);

    if (rateLimitError) throw rateLimitError;

    if (recentExports && recentExports.length > 0) {
      // IMPORTANT:
      // We intentionally return 200 here (instead of 429) to avoid some clients/
      // monitoring layers treating non-2xx as a "runtime error" and triggering
      // blank-screen fallbacks.
      // The frontend already handles `data.error` and shows a friendly toast.
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Você só pode exportar seus dados uma vez por hora.',
          rate_limited: true,
          retry_after_seconds: 60 * 60,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // PostgREST imposes a page limit. Read every page so exports are not silently truncated.
    const fetchAll = async (table: string, columns: string, userColumn = 'user_id') => {
      const rows: Record<string, unknown>[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from(table).select(columns).eq(userColumn, user.id)
          .order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) return rows;
      }
    };
    // Fetch all user data
    const [
      profileResult,
      walletResult,
      paperWalletResult,
      positionsResult,
      paperTrades,
      payments,
      notifications,
      comments,
      favorites,
      referralCodeResult,
      receivedReferralResult,
      sharedReferrals,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wallets').select('balance_available, total_deposited, currency, created_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('polymarket_paper_wallets').select('balance_usd, updated_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('polymarket_paper_positions').select('market_id, market_question, outcome_label, shares, average_price, updated_at').eq('user_id', user.id),
      fetchAll('polymarket_paper_trades', 'id, market_id, outcome_label, side, shares, price, notional_usd, created_at'),
      fetchAll('payments', 'id, type, amount, status, created_at'),
      fetchAll('notifications', 'id, type, title, message, created_at, is_read'),
      fetchAll('polymarket_event_comments', 'id, event_id, content, created_at'),
      fetchAll('polymarket_favorites', 'market_id, created_at'),
      supabase.from('paper_referral_codes').select('code, created_at').eq('owner_id', user.id).maybeSingle(),
      supabase.from('paper_referral_links').select('created_at').eq('referred_id', user.id).maybeSingle(),
      fetchAll('paper_referral_links', 'created_at', 'referrer_id'),
    ]);
    for (const result of [profileResult, walletResult, paperWalletResult, positionsResult, referralCodeResult, receivedReferralResult]) {
      if (result.error) throw result.error;
    }

    // Mask sensitive data
    const profile = profileResult.data ? {
      display_name: profileResult.data.display_name,
      bio: profileResult.data.bio,
      created_at: profileResult.data.created_at,
    } : null;

    const exportData = {
      exported_at: new Date().toISOString(),
      format,
      user_id: user.id,
      email_hint: user.email ? `${user.email.substring(0, 3)}***@***` : null,
      profile,
      wallet: walletResult.data,
      paper_wallet: paperWalletResult.data,
      positions: positionsResult.data || [],
      paper_trades: paperTrades,
      payments,
      notifications,
      comments,
      favorites,
      paper_referral: {
        code: referralCodeResult.data,
        received_invitation: receivedReferralResult.data,
        shared_invitations: sharedReferrals,
      },
    };

    // Log the export
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'DATA_EXPORT',
      details: { format, record_counts: {
        positions: exportData.positions.length,
        paper_trades: exportData.paper_trades.length,
        payments: exportData.payments.length,
      }},
    });

    console.log(`[export-user-data] Export complete for user ${user.id}`);

    // Convert to CSV if requested
    if (format === 'csv') {
      const csv = (value: unknown) => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
      const rows = ['categoria,dados_json'];
      for (const [category, value] of Object.entries(exportData)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          if (item !== null && item !== undefined) rows.push(`${csv(category)},${csv(JSON.stringify(item))}`);
        }
      }
      return new Response(JSON.stringify({ csv: rows.join('\n') }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(exportData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[export-user-data] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
