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
    const { data: recentExports } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('action', 'DATA_EXPORT')
      .gte('created_at', oneHourAgo)
      .limit(1);

    if (recentExports && recentExports.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded',
        message: 'Você só pode exportar seus dados uma vez por hora.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all user data
    const [
      profileResult,
      walletResult,
      contractsResult,
      transactionsResult,
      paymentsResult,
      notificationsResult,
      achievementsResult,
      commentsResult,
      favoritesResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('wallets').select('balance_available, total_deposited, currency, created_at').eq('user_id', user.id).single(),
      supabase.from('user_contracts').select('*, markets!user_contracts_market_id_fkey(title)').eq('user_id', user.id),
      supabase.from('transactions').select('*, markets!fk_transactions_market(title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      supabase.from('payments').select('id, type, amount, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('notifications').select('id, type, title, message, created_at, is_read').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('user_achievements').select('*, achievements(name, description)').eq('user_id', user.id),
      supabase.from('comments').select('id, content, created_at, market_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('user_favorites').select('market_id, created_at').eq('user_id', user.id),
    ]);

    // Mask sensitive data
    const profile = profileResult.data ? {
      display_name: profileResult.data.display_name,
      bio: profileResult.data.bio,
      total_trades: profileResult.data.total_trades,
      total_profit: profileResult.data.total_profit,
      total_volume: profileResult.data.total_volume,
      created_at: profileResult.data.created_at,
    } : null;

    const exportData = {
      exported_at: new Date().toISOString(),
      format,
      user_id: user.id,
      email_hint: user.email ? `${user.email.substring(0, 3)}***@***` : null,
      profile,
      wallet: walletResult.data,
      contracts: contractsResult.data?.map(c => ({
        market_title: (c as any).markets?.title || 'Unknown',
        position: c.position,
        shares: c.shares,
        average_price: c.average_price,
        total_invested: c.total_invested,
        status: c.status,
        created_at: c.created_at,
      })) || [],
      transactions: transactionsResult.data?.map(t => ({
        type: t.type,
        position: t.position,
        shares: t.shares,
        price_per_share: t.price_per_share,
        total_amount: t.total_amount,
        market_title: (t as any).markets?.title || 'Unknown',
        created_at: t.created_at,
      })) || [],
      payments: paymentsResult.data || [],
      notifications: notificationsResult.data || [],
      achievements: achievementsResult.data?.map(a => ({
        name: (a as any).achievements?.name,
        description: (a as any).achievements?.description,
        earned_at: a.earned_at,
      })) || [],
      comments: commentsResult.data || [],
      favorites: favoritesResult.data || [],
    };

    // Log the export
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'DATA_EXPORT',
      details: { format, record_counts: {
        contracts: exportData.contracts.length,
        transactions: exportData.transactions.length,
        payments: exportData.payments.length,
      }},
    });

    console.log(`[export-user-data] Export complete for user ${user.id}`);

    // Convert to CSV if requested
    if (format === 'csv') {
      const csvSections: string[] = [];
      
      // Profile section
      if (profile) {
        csvSections.push('=== PERFIL ===');
        csvSections.push(`Display Name,${profile.display_name || ''}`);
        csvSections.push(`Total Trades,${profile.total_trades || 0}`);
        csvSections.push(`Total Profit,${profile.total_profit || 0}`);
        csvSections.push('');
      }

      // Transactions section
      if (exportData.transactions.length > 0) {
        csvSections.push('=== TRANSAÇÕES ===');
        csvSections.push('Data,Tipo,Mercado,Posição,Contratos,Preço,Total');
        exportData.transactions.forEach(t => {
          csvSections.push(`${t.created_at},${t.type},${t.market_title},${t.position},${t.shares},${t.price_per_share},${t.total_amount}`);
        });
        csvSections.push('');
      }

      // Payments section
      if (exportData.payments.length > 0) {
        csvSections.push('=== PAGAMENTOS ===');
        csvSections.push('Data,Tipo,Valor,Status');
        exportData.payments.forEach(p => {
          csvSections.push(`${p.created_at},${p.type},${p.amount},${p.status}`);
        });
      }

      return new Response(JSON.stringify({ csv: csvSections.join('\n') }), {
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
