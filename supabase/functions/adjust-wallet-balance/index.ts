import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getCorsHeaders();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user with their token
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Claims error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUserId = claimsData.claims.sub as string;

    // Use service role for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit via database (persistent across function restarts)
    const { data: rateLimitOk, error: rateLimitError } = await adminClient.rpc(
      'check_rate_limit',
      { p_user_id: adminUserId, p_action: 'adjust-wallet-balance', p_max_requests: 10, p_window_secs: 60 }
    );
    if (rateLimitError || !rateLimitOk) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 10 adjustments per minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    console.log('[adjust-wallet-balance] Received body:', JSON.stringify(body));
    const { walletId, amount, reason } = body;

    // Validate inputs
    if (!walletId || typeof walletId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid wallet ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof amount !== 'number' || amount === 0 || isNaN(amount)) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return new Response(JSON.stringify({ error: 'Reason is required (min 3 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Amount limits
    if (Math.abs(amount) > 100000) {
      return new Response(JSON.stringify({ error: 'Amount exceeds maximum limit of R$100,000' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current wallet
    const { data: wallet, error: fetchError } = await adminClient
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet) {
      return new Response(JSON.stringify({ error: 'Wallet not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const previousBalance = Number(wallet.balance_available);
    const newBalance = previousBalance + amount;

    // Prevent negative balance
    if (newBalance < 0) {
      return new Response(JSON.stringify({ error: 'Insufficient balance for debit' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update wallet balance
    const { error: updateError } = await adminClient
      .from('wallets')
      .update({ balance_available: newBalance })
      .eq('id', walletId);

    if (updateError) {
      console.error('Error updating wallet:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update wallet' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record ledger entry
    const { error: ledgerError } = await adminClient
      .from('ledger_entries')
      .insert({
        user_id: wallet.user_id,
        wallet_id: walletId,
        ref_type: 'ADJUSTMENT',
        direction: amount >= 0 ? 'CREDIT' : 'DEBIT',
        amount: Math.abs(amount),
        fee_amount: 0,
        net_amount: Math.abs(amount),
        platform_revenue: 0,
        status: 'COMPLETED',
        meta: { 
          reason: reason.trim(), 
          adjusted_by: adminUserId,
          previous_balance: previousBalance,
          new_balance: newBalance
        }
      });

    if (ledgerError) {
      console.error('Error creating ledger entry:', ledgerError);
      // Don't fail the request, just log it
    }

    // Record audit log
    const { error: auditError } = await adminClient
      .from('admin_audit_logs')
      .insert({
        actor_user_id: adminUserId,
        action: 'WALLET_ADJUSTED',
        entity: 'wallets',
        entity_id: walletId,
        before_data: { balance_available: previousBalance },
        after_data: { 
          balance_available: newBalance,
          adjustment: amount,
          reason: reason.trim()
        }
      });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request, just log it
    }

    console.log(`[adjust-wallet-balance] Admin ${adminUserId} adjusted wallet ${walletId} by ${amount}. New balance: ${newBalance}`);

    return new Response(JSON.stringify({ 
      success: true,
      previousBalance,
      newBalance,
      adjustment: amount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in adjust-wallet-balance:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
