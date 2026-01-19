import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logStep, logError } from '../_shared/logging.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketOptionInput {
  id?: string;
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

  const functionName = 'update-admin-event';

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
    const { action, eventId, status, reason, result, evidence } = body;

    logStep(functionName, 'Processing action', { action, eventId, status });

    // Fetch admin profile for audit log
    const { data: adminProfile } = await adminClient
      .from('profiles')
      .select('username, full_name')
      .eq('id', userId)
      .single();

    const adminName = adminProfile?.full_name || adminProfile?.username || 'Admin';

    if (action === 'update_status') {
      // Get current event
      const { data: currentEvent, error: fetchError } = await adminClient
        .from('markets')
        .select('status, title')
        .eq('id', eventId)
        .single();

      if (fetchError || !currentEvent) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const previousStatus = currentEvent.status;

      // Update status
      const updateData: Record<string, unknown> = { 
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'HALTED' && reason) {
        updateData.halt_reason = reason;
      }

      const { data: updatedEvent, error: updateError } = await adminClient
        .from('markets')
        .update(updateData)
        .eq('id', eventId)
        .select()
        .single();

      if (updateError) {
        logError(functionName, 'Update failed', { error: updateError });
        return new Response(JSON.stringify({ error: 'Failed to update event' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log audit entry
      await adminClient.from('admin_audit_logs').insert({
        admin_id: userId,
        action: 'market_status_change',
        target_type: 'market',
        target_id: eventId,
        details: {
          previous_status: previousStatus,
          new_status: status,
          reason: reason || null,
          market_title: currentEvent.title,
          admin_name: adminName,
        },
      });

      logStep(functionName, 'Status updated', { eventId, previousStatus, newStatus: status });

      return new Response(
        JSON.stringify({ success: true, event: updatedEvent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'settle') {
      // Get current event
      const { data: currentEvent, error: fetchError } = await adminClient
        .from('markets')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError || !currentEvent) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!['PENDING', 'HALTED', 'CONTESTED'].includes(currentEvent.status)) {
        return new Response(JSON.stringify({ error: 'Event cannot be settled in current status' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update to settled
      const { data: settledEvent, error: settleError } = await adminClient
        .from('markets')
        .update({
          status: 'SETTLED',
          result: result,
          result_source: evidence,
          settlement_date: new Date().toISOString(),
          settled_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
        .select()
        .single();

      if (settleError) {
        logError(functionName, 'Settlement failed', { error: settleError });
        return new Response(JSON.stringify({ error: 'Failed to settle event' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log audit entry
      await adminClient.from('admin_audit_logs').insert({
        admin_id: userId,
        action: 'market_settled',
        target_type: 'market',
        target_id: eventId,
        details: {
          result,
          evidence,
          market_title: currentEvent.title,
          admin_name: adminName,
        },
      });

      logStep(functionName, 'Event settled, processing payouts...', { eventId, result });

      // Process payouts to winners
      const { data: payoutResult, error: payoutError } = await adminClient.rpc(
        'process_market_payouts',
        { p_market_id: eventId, p_winning_outcome: result }
      );

      if (payoutError) {
        logError(functionName, 'Payout processing error (non-fatal)', { error: payoutError });
      } else {
        logStep(functionName, 'Payouts processed', payoutResult);
      }

      // Process copy trade commissions
      const { data: commissionResult, error: commissionError } = await adminClient.rpc(
        'process_copy_trade_commissions',
        { p_market_id: eventId, p_winning_outcome: result }
      );

      if (commissionError) {
        logError(functionName, 'Commission processing error (non-fatal)', { error: commissionError });
      } else {
        logStep(functionName, 'Copy trade commissions processed', commissionResult);
      }

      // Process market settlement achievements
      const { error: achievementError } = await adminClient.rpc(
        'process_market_settlement_achievements',
        { p_market_id: eventId, p_winning_outcome: result }
      );

      if (achievementError) {
        logError(functionName, 'Achievement processing error (non-fatal)', { error: achievementError });
      }

      logStep(functionName, 'Settlement complete', { eventId, result, payoutResult, commissionResult });

      return new Response(
        JSON.stringify({ 
          success: true, 
          event: settledEvent,
          payouts: payoutResult,
          commissions: commissionResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_event') {
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
        reason: updateReason,
        options,
      } = body;

      // Get current event for comparison
      const { data: currentEvent, error: fetchError } = await adminClient
        .from('markets')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError || !currentEvent) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate dates if both are provided
      const finalCloseDate = closeDate ?? currentEvent.close_date;
      const finalSettlementDate = settlementDate ?? currentEvent.settlement_date;
      
      if (finalCloseDate && finalSettlementDate && new Date(finalCloseDate) > new Date(finalSettlementDate)) {
        return new Response(JSON.stringify({ error: 'Data de halt de trading deve ser anterior ou igual à data do evento' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (closeDate !== undefined) updateData.close_date = closeDate;
      if (settlementDate !== undefined) updateData.settlement_date = settlementDate;
      if (imageUrl !== undefined) updateData.image_url = imageUrl;
      if (tags !== undefined) updateData.tags = tags;
      if (cardStyle !== undefined) updateData.card_style = cardStyle;
      if (settlementType !== undefined) updateData.settlement_type = settlementType;
      if (resolution !== undefined) updateData.resolution = resolution;

      // Handle price update for BINARY markets
      if (yesPrice !== undefined && currentEvent.market_type === 'BINARY') {
        updateData.current_yes_price = yesPrice;
        updateData.current_no_price = 1 - yesPrice;
      }

      const { data: updatedEvent, error: updateError } = await adminClient
        .from('markets')
        .update(updateData)
        .eq('id', eventId)
        .select()
        .single();

      if (updateError) {
        logError(functionName, 'Event update failed', { error: updateError });
        return new Response(JSON.stringify({ error: 'Failed to update event' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle options update for MULTIPLE markets
      if (options && currentEvent.market_type === 'MULTIPLE') {
        const lmsrB = currentEvent.lmsr_b || 100;

        for (const opt of options as MarketOptionInput[]) {
          const prob = Math.max(0.01, Math.min(0.99, opt.probability / 100));
          const refProb = 1 / options.length;
          const shares = lmsrB * Math.log(prob / refProb);

          if (opt.id) {
            // Update existing option
            await adminClient
              .from('market_options')
              .update({
                label: opt.label,
                description: opt.description || null,
                image_url: opt.imageUrl || null,
                current_price: opt.probability / 100,
                shares: shares,
                display_order: opt.displayOrder,
              })
              .eq('id', opt.id);
          } else {
            // Insert new option
            await adminClient
              .from('market_options')
              .insert({
                market_id: eventId,
                label: opt.label,
                description: opt.description || null,
                image_url: opt.imageUrl || null,
                shares: shares,
                current_price: opt.probability / 100,
                display_order: opt.displayOrder,
              });
          }
        }

        logStep(functionName, 'Options updated', { count: options.length });
      }

      // Log audit entry with changes
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (title !== undefined && title !== currentEvent.title) {
        changes.title = { from: currentEvent.title, to: title };
      }
      if (yesPrice !== undefined && yesPrice !== currentEvent.current_yes_price) {
        changes.yes_price = { from: currentEvent.current_yes_price, to: yesPrice };
      }
      if (category !== undefined && category !== currentEvent.category) {
        changes.category = { from: currentEvent.category, to: category };
      }

      await adminClient.from('admin_audit_logs').insert({
        admin_id: userId,
        action: 'market_updated',
        target_type: 'market',
        target_id: eventId,
        details: {
          market_title: updatedEvent.title,
          changes,
          reason: updateReason || null,
          admin_name: adminName,
        },
      });

      logStep(functionName, 'Event updated', { eventId, changes: Object.keys(changes) });

      return new Response(
        JSON.stringify({ success: true, event: updatedEvent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_options') {
      // Dedicated action for updating multiple options
      const { options: optionsToUpdate } = body;

      if (!optionsToUpdate || !Array.isArray(optionsToUpdate)) {
        return new Response(JSON.stringify({ error: 'Options array is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get current event
      const { data: currentEvent, error: fetchError } = await adminClient
        .from('markets')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError || !currentEvent) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (currentEvent.market_type !== 'MULTIPLE') {
        return new Response(JSON.stringify({ error: 'This action is only for multiple-option markets' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const lmsrB = currentEvent.lmsr_b || 100;

      // Update each option
      for (const opt of optionsToUpdate as MarketOptionInput[]) {
        const prob = Math.max(0.01, Math.min(0.99, opt.probability / 100));
        const refProb = 1 / optionsToUpdate.length;
        const shares = lmsrB * Math.log(prob / refProb);

        if (opt.id) {
          await adminClient
            .from('market_options')
            .update({
              label: opt.label,
              description: opt.description || null,
              image_url: opt.imageUrl || null,
              current_price: opt.probability / 100,
              shares: shares,
              display_order: opt.displayOrder,
            })
            .eq('id', opt.id);
        }
      }

      // Log audit entry
      await adminClient.from('admin_audit_logs').insert({
        admin_id: userId,
        action: 'market_options_updated',
        target_type: 'market',
        target_id: eventId,
        details: {
          market_title: currentEvent.title,
          options_count: optionsToUpdate.length,
          admin_name: adminName,
        },
      });

      logStep(functionName, 'Options updated', { eventId, count: optionsToUpdate.length });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_card_style') {
      const { cardStyle } = body;
      
      if (!['default', 'buttons', 'simple', 'minimal'].includes(cardStyle)) {
        return new Response(JSON.stringify({ error: 'Invalid card style' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updatedEvent, error: updateError } = await adminClient
        .from('markets')
        .update({
          card_style: cardStyle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
        .select()
        .single();

      if (updateError) {
        logError(functionName, 'Card style update failed', { error: updateError });
        return new Response(JSON.stringify({ error: 'Failed to update card style' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      logStep(functionName, 'Card style updated', { eventId, cardStyle });

      return new Response(
        JSON.stringify({ success: true, event: updatedEvent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      // Get current event for validation
      const { data: currentEvent, error: fetchError } = await adminClient
        .from('markets')
        .select('status, title, market_type')
        .eq('id', eventId)
        .single();

      if (fetchError || !currentEvent) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only allow deleting HALTED events
      if (currentEvent.status !== 'HALTED') {
        return new Response(JSON.stringify({ error: 'Only paused events can be deleted' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete options first if MULTIPLE market
      if (currentEvent.market_type === 'MULTIPLE') {
        await adminClient
          .from('market_options')
          .delete()
          .eq('market_id', eventId);
      }

      // Delete event
      const { error: deleteError } = await adminClient
        .from('markets')
        .delete()
        .eq('id', eventId);

      if (deleteError) {
        logError(functionName, 'Delete failed', { error: deleteError });
        return new Response(JSON.stringify({ error: 'Failed to delete event' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log audit entry
      await adminClient.from('admin_audit_logs').insert({
        admin_id: userId,
        action: 'market_deleted',
        target_type: 'market',
        target_id: eventId,
        details: {
          market_title: currentEvent.title,
          admin_name: adminName,
        },
      });

      logStep(functionName, 'Event deleted', { eventId });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(functionName, error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
