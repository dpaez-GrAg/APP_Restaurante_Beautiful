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
    const {
      customer_name,
      customer_email,
      customer_phone,
      date,
      time,
      guests,
      special_requests,
      duration_minutes = 90,
    } = await req.json();

    // Validate required fields
    if (!customer_name || !customer_email || !date || !time || !guests) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: customer_name, customer_email, date, time, guests",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create or find customer
    const { data: existingCustomer } = await supabaseClient
      .from("customers")
      .select("*")
      .eq("email", customer_email)
      .single();

    let customerId;
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabaseClient
        .from("customers")
        .insert({
          name: customer_name,
          email: customer_email,
          phone: customer_phone || null,
        })
        .select()
        .single();

      if (customerError) {
        console.error("Customer creation error:", customerError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create customer: " + customerError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      customerId = newCustomer.id;
    }

    // Create reservation with table assignment using RPC function
    const { data: result, error: reservationError } = await supabaseClient.rpc("create_reservation_with_assignment", {
      p_customer_id: customerId,
      p_date: date,
      p_time: time,
      p_guests: guests,
      p_special_requests: special_requests || null,
      p_duration_minutes: duration_minutes,
    });

    if (reservationError) {
      console.error("Reservation creation error:", reservationError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create reservation: " + reservationError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if reservation was successful
    if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
      const errorMessage =
        result && typeof result === "object" && "error" in result
          ? (result.error as string)
          : "No se pudo crear la reserva. Por favor, inténtalo de nuevo.";

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reservation_id: result.reservation_id,
          customer_id: customerId,
          date: date,
          time: time,
          guests: guests,
          status: "confirmed",
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
