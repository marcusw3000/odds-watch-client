import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { createFunctionLogger } from '../_shared/logging.ts';

const logger = createFunctionLogger('link-referral');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    logger.step('User authenticated', { userId });

    // 2. Parse body
    const { referral_code } = await req.json();
    if (!referral_code || typeof referral_code !== 'string') {
      return new Response(JSON.stringify({ error: 'referral_code é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = referral_code.trim().toUpperCase();
    logger.step('Processing referral code', { code });

    // 3. Use service_role client for privileged operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 4. Check if user already has a referral link
    const { data: existingLink } = await serviceClient
      .from('referrals')
      .select('id')
      .eq('referred_id', userId)
      .limit(1)
      .maybeSingle();

    if (existingLink) {
      return new Response(JSON.stringify({ error: 'Você já possui uma indicação vinculada' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Find the referral by code
    const { data: referral, error: findError } = await serviceClient
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .eq('status', 'PENDING')
      .is('referred_id', null)
      .limit(1)
      .maybeSingle();

    if (findError || !referral) {
      logger.step('Referral not found', { code, findError });
      return new Response(JSON.stringify({ error: 'Código de indicação inválido ou já utilizado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Prevent self-referral
    if (referral.referrer_id === userId) {
      return new Response(JSON.stringify({ error: 'Você não pode usar seu próprio código' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Get settings for discount duration
    const { data: settings } = await serviceClient
      .from('referral_settings')
      .select('discount_duration_days')
      .limit(1)
      .single();

    const discountDays = settings?.discount_duration_days ?? 30;
    const discountExpiresAt = new Date();
    discountExpiresAt.setDate(discountExpiresAt.getDate() + discountDays);

    // 8. Link the referral
    const { error: updateError } = await serviceClient
      .from('referrals')
      .update({
        referred_id: userId,
        discount_expires_at: discountExpiresAt.toISOString(),
      })
      .eq('id', referral.id);

    if (updateError) {
      logger.error(updateError, { referralId: referral.id });
      return new Response(JSON.stringify({ error: 'Erro ao vincular indicação' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.step('Referral linked successfully', { referralId: referral.id, userId });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error(error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
