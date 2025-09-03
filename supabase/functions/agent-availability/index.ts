import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate API key (optional but recommended)
    const agentApiKey = Deno.env.get('AGENT_API_KEY');
    const providedKey = req.headers.get('x-agent-key');
    
    if (agentApiKey && providedKey !== agentApiKey) {
      console.log('Invalid API key provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const guestsParam = url.searchParams.get('guests');
    const durationParam = url.searchParams.get('duration_minutes') || '90';

    if (!dateParam || !guestsParam) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters: date and guests' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const guests = parseInt(guestsParam);
    const durationMinutes = parseInt(durationParam);

    if (isNaN(guests) || guests < 1 || guests > 20) {
      return new Response(JSON.stringify({ 
        error: 'Invalid guests parameter: must be between 1 and 20' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isNaN(durationMinutes) || durationMinutes < 30 || durationMinutes > 240) {
      return new Response(JSON.stringify({ 
        error: 'Invalid duration_minutes parameter: must be between 30 and 240' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking availability for ${guests} guests on ${dateParam} (${durationMinutes} minutes)`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the get_available_time_slots function
    const { data: timeSlots, error } = await supabase.rpc('get_available_time_slots', {
      p_date: dateParam,
      p_guests: guests,
      p_duration_minutes: durationMinutes
    });

    if (error) {
      console.error('Error fetching time slots:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch available time slots' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${timeSlots?.length || 0} available time slots`);

    // Format the response
    const availableSlots = timeSlots?.map((slot: any) => ({
      id: slot.id,
      time: slot.slot_time,
      capacity: slot.capacity
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      date: dateParam,
      guests: guests,
      duration_minutes: durationMinutes,
      available_slots: availableSlots,
      total_slots: availableSlots.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in agent-availability function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});