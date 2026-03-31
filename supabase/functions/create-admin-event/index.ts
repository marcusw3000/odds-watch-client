import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStep, logError } from '../_shared/logging.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

const VALID_CATEGORIES = ['economia', 'política', 'esportes', 'tecnologia', 'entretenimento', 'ciência', 'geopolítica', 'outros'];
const VALID_MARKET_TYPES = ['BINARY', 'MULTIPLE'];
const VALID_SETTLEMENT_TYPES = ['MANUAL', 'AUTOMATIC'];
const VALID_CARD_STYLES = ['default', 'highlight', 'compact'];
const VALID_RECURRENCE_TYPES = ['none', 'weekly', 'monthly', 'quarterly', 'annually'];
const VALID_LIQUIDITY = ['low', 'medium', 'high'];

const URL_REGEX = /^https?:\/\/.{1,2000}$/;

function err400(corsH: Record<string, string>, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });
}

interface MarketOptionInput {
  label: string;
  description?: string;
  imageUrl?: string;
  probability: number;
  displayOrder: number;
}

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
      settlementDate,
      imageUrl,
      tags,
      yesPrice,
      settlementType,
      resolution,
      cardStyle,
      marketType = 'BINARY',
      recurrenceType,
      options,
      liquidity = 'medium',
      maxWinners = 1,
    } = body;

    logStep(functionName, 'Creating event', { title, category, marketType, liquidity });

    // --- Input validation ---
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 500)
      return err400(corsHeaders, 'Título inválido (3–500 caracteres)');

    if (!description || typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 5000)
      return err400(corsHeaders, 'Descrição inválida (10–5000 caracteres)');

    if (!category || !VALID_CATEGORIES.includes(category))
      return err400(corsHeaders, `Categoria inválida. Valores aceitos: ${VALID_CATEGORIES.join(', ')}`);

    if (!closeDate || isNaN(Date.parse(closeDate)))
      return err400(corsHeaders, 'Data de encerramento inválida');

    if (!settlementDate || isNaN(Date.parse(settlementDate)))
      return err400(corsHeaders, 'Data de resolução inválida');

    if (imageUrl !== undefined && imageUrl !== null && imageUrl !== '') {
      if (typeof imageUrl !== 'string' || !URL_REGEX.test(imageUrl))
        return err400(corsHeaders, 'imageUrl deve ser uma URL HTTP/HTTPS válida');
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.length > 10 || tags.some((t: unknown) => typeof t !== 'string' || t.length > 50))
        return err400(corsHeaders, 'Tags inválidas: máx 10 itens, cada um com até 50 caracteres');
    }

    if (!VALID_MARKET_TYPES.includes(marketType))
      return err400(corsHeaders, `marketType inválido. Aceitos: ${VALID_MARKET_TYPES.join(', ')}`);

    if (settlementType !== undefined && !VALID_SETTLEMENT_TYPES.includes(settlementType))
      return err400(corsHeaders, `settlementType inválido. Aceitos: ${VALID_SETTLEMENT_TYPES.join(', ')}`);

    if (cardStyle !== undefined && !VALID_CARD_STYLES.includes(cardStyle))
      return err400(corsHeaders, `cardStyle inválido. Aceitos: ${VALID_CARD_STYLES.join(', ')}`);

    if (recurrenceType !== undefined && !VALID_RECURRENCE_TYPES.includes(recurrenceType))
      return err400(corsHeaders, `recurrenceType inválido. Aceitos: ${VALID_RECURRENCE_TYPES.join(', ')}`);

    if (!VALID_LIQUIDITY.includes(liquidity))
      return err400(corsHeaders, `liquidity inválido. Aceitos: ${VALID_LIQUIDITY.join(', ')}`);

    if (typeof maxWinners !== 'number' || !Number.isInteger(maxWinners) || maxWinners < 1 || maxWinners > 100)
      return err400(corsHeaders, 'maxWinners inválido (inteiro entre 1 e 100)');
    // --- Fim da validação ---

    // Validate that closeDate (trading halt) is before or equal to settlementDate (event date)
    if (new Date(closeDate) > new Date(settlementDate)) {
      return err400(corsHeaders, 'Data de halt de trading deve ser anterior ou igual à data do evento');
    }

    // Validate options for MULTIPLE type
    if (marketType === 'MULTIPLE') {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return new Response(JSON.stringify({ error: 'Multiple markets require at least 2 options' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate probability sum
      const probSum = options.reduce((sum: number, opt: MarketOptionInput) => sum + opt.probability, 0);
      if (probSum < 99 || probSum > 101) {
        return new Response(JSON.stringify({ error: 'Option probabilities must sum to 100%' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Configurable liquidity parameter (Kalshi/Polymarket style)
    const liquidityMap: Record<string, number> = { low: 100, medium: 300, high: 500 };
    const lmsrB = liquidityMap[liquidity] || 300;

    logStep(functionName, 'Liquidity configured', { level: liquidity, lmsr_b: lmsrB });

    // For BINARY markets
    let initialYesPrice = 0.5;
    let initialNoPrice = 0.5;
    let yesShares = lmsrB * Math.log(2);
    let noShares = lmsrB * Math.log(2);

    if (marketType === 'BINARY' && yesPrice !== undefined) {
      initialYesPrice = yesPrice;
      initialNoPrice = 1 - yesPrice;
      // Calculate shares based on initial price
      // P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
      // For simplicity, we set qNo = 0 and calculate qYes
      const prob = Math.max(0.01, Math.min(0.99, initialYesPrice));
      yesShares = lmsrB * Math.log(prob / (1 - prob));
      noShares = 0;
    }

    // Insert market
    const { data: newEvent, error: insertError } = await adminClient
      .from('markets')
      .insert({
        title,
        description,
        category,
        status: 'OPEN',
        close_date: closeDate,
        settlement_date: settlementDate,
        image_url: imageUrl || null,
        tags: tags || [],
        current_yes_price: marketType === 'BINARY' ? initialYesPrice : 0,
        current_no_price: marketType === 'BINARY' ? initialNoPrice : 0,
        settlement_type: settlementType || 'MANUAL',
        resolution: resolution || null,
        card_style: cardStyle || 'default',
        recurrence_type: recurrenceType || 'none',
        lmsr_b: lmsrB,
        yes_shares: marketType === 'BINARY' ? yesShares : 0,
        no_shares: marketType === 'BINARY' ? noShares : 0,
        total_volume: 0,
        market_type: marketType,
        options_exclusive: true, // All options are mutually exclusive by default
        max_winners: marketType === 'MULTIPLE' ? Math.min(maxWinners, options?.length || 1) : 1,
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

    // If MULTIPLE type, create options
    if (marketType === 'MULTIPLE' && options && options.length > 0) {
      const optionsToInsert = options.map((opt: MarketOptionInput, index: number) => {
        // Calculate initial shares for this option
        // Using LMSR formula: qi = b * ln(Pi / P0) where P0 is reference probability
        const prob = Math.max(0.01, Math.min(0.99, opt.probability / 100));
        const refProb = 1 / options.length; // Reference probability (equal distribution)
        const shares = lmsrB * Math.log(prob / refProb);

        return {
          market_id: newEvent.id,
          label: opt.label,
          description: opt.description || null,
          image_url: opt.imageUrl || null,
          shares: shares,
          current_price: opt.probability / 100, // Store as decimal
          display_order: opt.displayOrder ?? index,
        };
      });

      const { error: optionsError } = await adminClient
        .from('market_options')
        .insert(optionsToInsert);

      if (optionsError) {
        logError(functionName, 'Failed to create options', { error: optionsError });
        // Rollback: delete the market
        await adminClient.from('markets').delete().eq('id', newEvent.id);
        return new Response(JSON.stringify({ error: 'Failed to create market options' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      logStep(functionName, 'Options created', { count: options.length });
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
      actor_user_id: userId,
      action: 'market_created',
      entity: 'markets',
      entity_id: newEvent.id,
      after_data: {
        market_title: title,
        category,
        market_type: marketType,
        options_count: marketType === 'MULTIPLE' ? options?.length : 2,
        initial_yes_price: marketType === 'BINARY' ? initialYesPrice : null,
        liquidity_level: liquidity,
        lmsr_b: lmsrB,
        admin_name: adminName,
      },
    });

    logStep(functionName, 'Event created', { eventId: newEvent.id, marketType });

    // Record initial price snapshot for the new market
    const initialYesPriceToRecord = marketType === 'BINARY' ? initialYesPrice : 0.5;
    const initialNoPriceToRecord = marketType === 'BINARY' ? initialNoPrice : 0.5;
    
    const { error: historyError } = await adminClient
      .from('market_price_history')
      .insert({
        market_id: newEvent.id,
        yes_price: initialYesPriceToRecord,
        no_price: initialNoPriceToRecord,
        source: 'initial',
      });

    if (historyError) {
      logError(functionName, 'Failed to record initial price history', { error: historyError });
      // Non-blocking error - market was created successfully
    } else {
      logStep(functionName, 'Initial price history recorded');
    }

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
