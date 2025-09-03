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

  if (req.method !== 'POST') {
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

    // Parse request body
    const body = await req.json();
    const { name, email, phone, guests, date, time, comments, duration_minutes } = body;

    // Validate required fields
    if (!name || !email || !guests || !date || !time) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: name, email, guests, date, time' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate data types and ranges
    if (typeof guests !== 'number' || guests < 1 || guests > 20) {
      return new Response(JSON.stringify({ 
        error: 'Invalid guests: must be a number between 1 and 20' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const duration = duration_minutes || 90;
    if (typeof duration !== 'number' || duration < 30 || duration > 240) {
      return new Response(JSON.stringify({ 
        error: 'Invalid duration_minutes: must be a number between 30 and 240' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid date format: must be YYYY-MM-DD' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid time format: must be HH:MM' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating reservation for ${name} (${email}) - ${guests} guests on ${date} at ${time}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the admin_create_reservation function
    const { data: result, error } = await supabase.rpc('admin_create_reservation', {
      p_customer_name: name,
      p_customer_email: email,
      p_customer_phone: phone || null,
      p_date: date,
      p_time: time,
      p_guests: guests,
      p_special_requests: comments || null,
      p_table_ids: null, // Let the function auto-assign tables
      p_duration_minutes: duration
    });

    if (error) {
      console.error('Error creating reservation:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to create reservation: ' + error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!result?.success) {
      console.log('Reservation creation failed:', result?.error);
      return new Response(JSON.stringify({ 
        error: result?.error || 'Failed to create reservation' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Reservation created successfully. ID: ${result.reservation_id}`);

    return new Response(JSON.stringify({
      success: true,
      reservation_id: result.reservation_id,
      message: 'Reservation created successfully',
      details: {
        customer: name,
        email: email,
        phone: phone,
        guests: guests,
        date: date,
        time: time,
        duration_minutes: duration,
        comments: comments,
        assigned_tables: result.assigned_tables
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in agent-create-reservation function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});