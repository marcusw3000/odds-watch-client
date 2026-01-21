import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify admin authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check admin role using service role client
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Admin ${user.id} (${roleData.role}) fetching support tickets`);

    // Parse filters from request body
    const body = await req.json().catch(() => ({}));
    const { status, category, priority, assignedTo, search, ticketId, limit = 25, offset = 0 } = body;

    // If fetching single ticket by ID
    if (ticketId) {
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      if (ticket) {
        // Fetch user info
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .eq('id', ticket.user_id)
          .single();

        const enrichedTicket = {
          ...ticket,
          user_display_name: userProfile?.display_name,
          user_email: userProfile?.email,
          assigned_name: null as string | null,
        };

        // Fetch assigned staff info if exists
        if (ticket.assigned_to) {
          const { data: assignedProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', ticket.assigned_to)
            .single();
          enrichedTicket.assigned_name = assignedProfile?.display_name || null;
        }

        return new Response(JSON.stringify([enrichedTicket]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build count query for total
    let countQuery = supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true });

    if (status) countQuery = countQuery.eq('status', status);
    if (category) countQuery = countQuery.eq('category', category);
    if (priority) countQuery = countQuery.eq('priority', priority);
    if (assignedTo === 'unassigned') {
      countQuery = countQuery.is('assigned_to', null);
    } else if (assignedTo) {
      countQuery = countQuery.eq('assigned_to', assignedTo);
    }
    if (search) countQuery = countQuery.ilike('subject', `%${search}%`);

    const { count: totalCount, error: countError } = await countQuery;
    if (countError) throw countError;

    // Build query using service role (bypasses RLS)
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (priority) query = query.eq('priority', priority);
    if (assignedTo === 'unassigned') {
      query = query.is('assigned_to', null);
    } else if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (search) query = query.ilike('subject', `%${search}%`);

    const { data: tickets, error } = await query;
    if (error) throw error;

    if (!tickets || tickets.length === 0) {
      console.log('No tickets found');
      return new Response(JSON.stringify({ tickets: [], totalCount: totalCount || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${tickets.length} tickets`);

    // Fetch user info for each ticket
    const userIds = [...new Set(tickets.map(t => t.user_id).filter(Boolean))];
    const assignedIds = [...new Set(tickets.filter(t => t.assigned_to).map(t => t.assigned_to))];
    const allIds = [...new Set([...userIds, ...assignedIds])];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', allIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const enrichedTickets = tickets.map(ticket => ({
      ...ticket,
      user_display_name: profileMap.get(ticket.user_id)?.display_name,
      user_email: profileMap.get(ticket.user_id)?.email,
      assigned_name: ticket.assigned_to ? profileMap.get(ticket.assigned_to)?.display_name : null,
    }));

    return new Response(JSON.stringify({ tickets: enrichedTickets, totalCount: totalCount || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching admin support tickets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
