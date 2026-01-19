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
    // Parse query parameters
    const url = new URL(req.url);
    const sortBy = url.searchParams.get('sortBy') || 'profit';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    // Use service role to access data
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch only PUBLIC profiles using the secure view
    const { data: profiles, error } = await adminClient
      .from('profiles_public')
      .select('id, display_name, is_public, show_profit, show_roi, show_volume, show_trades, total_profit, roi_percent, total_volume, total_trades, winning_trades');

    if (error) {
      console.error('Error fetching profiles:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter to only public profiles with display_name set
    const entries = (profiles || [])
      .filter(p => p.is_public && p.display_name && p.display_name.trim() !== '')
      .map(profile => ({
        user_id: profile.id,
        display_name: profile.display_name,
        // Only include stats if user chose to show them
        total_profit: profile.show_profit ? (profile.total_profit || 0) : null,
        roi_percent: profile.show_roi ? (profile.roi_percent || 0) : null,
        total_volume: profile.show_volume ? (profile.total_volume || 0) : null,
        total_trades: profile.show_trades ? (profile.total_trades || 0) : null,
        winning_trades: profile.show_trades ? (profile.winning_trades || 0) : null,
        // Privacy flags
        show_profit: profile.show_profit,
        show_roi: profile.show_roi,
        show_volume: profile.show_volume,
        show_trades: profile.show_trades,
      }));

    // Sort by selected metric (only use non-hidden values)
    const sortFn = {
      profit: (a: any, b: any) => (b.total_profit ?? -Infinity) - (a.total_profit ?? -Infinity),
      roi: (a: any, b: any) => (b.roi_percent ?? -Infinity) - (a.roi_percent ?? -Infinity),
      volume: (a: any, b: any) => (b.total_volume ?? -Infinity) - (a.total_volume ?? -Infinity),
      trades: (a: any, b: any) => (b.total_trades ?? -Infinity) - (a.total_trades ?? -Infinity),
    };

    entries.sort(sortFn[sortBy as keyof typeof sortFn] || sortFn.profit);

    // Add ranks and limit
    const rankedEntries = entries.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    console.log(`[get-leaderboard-data] Returned ${rankedEntries.length} entries sorted by ${sortBy}`);

    return new Response(JSON.stringify({ entries: rankedEntries }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-leaderboard-data:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
