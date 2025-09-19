import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body
    const { date, guests } = await req.json();

    // Validate required fields
    if (!date || !guests) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: date, guests",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get available time slots for the given date and guest count
    const { data: availableSlots, error } = await supabaseClient.rpc("get_available_slots", {
      p_date: date,
      p_guests: guests,
    });

    if (error) {
      console.error("Availability check error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to check availability: " + error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return available slots
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          date: date,
          guests: guests,
          available_slots: availableSlots || [],
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error: " + error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
