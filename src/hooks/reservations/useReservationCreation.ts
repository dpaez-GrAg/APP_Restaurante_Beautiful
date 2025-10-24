/**
 * Hook for creating reservations with customer management
 * Centralizes the duplicated logic from ReservarPage and ReservationForm
 */

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { CreateReservationInput, ReservationResult } from "@/types/reservation";
import { formatDateLocal } from "@/lib/dateUtils";

interface UseReservationCreationReturn {
  createReservation: (input: CreateReservationInput) => Promise<ReservationResult>;
  isLoading: boolean;
  error: string | null;
}

export const useReservationCreation = (): UseReservationCreationReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const createReservation = async (input: CreateReservationInput): Promise<ReservationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create or get customer
      const { data: customerId, error: customerError } = await supabase.rpc("create_customer_optional_email", {
        p_name: input.customerName,
        p_phone: input.customerPhone || null,
        p_email: input.customerEmail || null,
      });

      if (customerError) {
        console.error("Error creating customer:", customerError);

        let errorMessage = "Error desconocido al crear el cliente";

        if (customerError.code === "42883") {
          errorMessage = "La función de creación de cliente no existe en la base de datos. Contacta al administrador.";
        } else if (customerError.code === "23505") {
          errorMessage = "Ya existe un cliente con estos datos. Intenta con información diferente.";
        } else if (customerError.message.includes("permission denied")) {
          errorMessage = "No tienes permisos para crear clientes. Contacta al administrador.";
        } else if (customerError.message.includes("function") && customerError.message.includes("does not exist")) {
          errorMessage = "La función de base de datos no está disponible. Contacta al administrador.";
        } else {
          errorMessage = `Error de base de datos al crear cliente: ${customerError.message}`;
        }

        throw new Error(errorMessage);
      }

      if (!customerId) {
        throw new Error("La función de creación de cliente no devolvió un ID válido. Contacta al administrador.");
      }

      // Step 2: Create reservation with table assignment
      const { data: result, error: reservationError } = await supabase.rpc("create_reservation_with_assignment", {
        p_customer_id: customerId,
        p_date: input.date,
        p_time: input.time,
        p_guests: input.guests,
        p_special_requests: input.special_requests || null,
        p_duration_minutes: input.duration_minutes || 90,
      });

      if (reservationError) {
        console.error("Supabase reservation error:", reservationError);

        let errorMessage = "Error desconocido al crear la reserva";

        if (reservationError.code === "42883") {
          errorMessage = "La función de creación de reservas no existe en la base de datos. Contacta al administrador.";
        } else if (reservationError.message.includes("permission denied")) {
          errorMessage = "No tienes permisos para crear reservas. Contacta al administrador.";
        } else if (
          reservationError.message.includes("function") &&
          reservationError.message.includes("does not exist")
        ) {
          errorMessage = "La función de reservas no está disponible. Contacta al administrador.";
        } else {
          errorMessage = `Error de base de datos al crear reserva: ${reservationError.message}`;
        }

        throw new Error(errorMessage);
      }

      // Step 3: Validate result
      if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
        console.error("Reservation creation failed:", result);

        const errorMessage =
          result && typeof result === "object" && "error" in result
            ? `Error en la lógica de reserva: ${result.error as string}`
            : "La reserva no se pudo procesar correctamente. Verifica disponibilidad e inténtalo de nuevo.";

        throw new Error(errorMessage);
      }

      const resultObj = result as any;
      
      setIsLoading(false);
      return {
        success: true,
        reservation_id: resultObj.reservation_id,
        message: "Reserva creada exitosamente"
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido. Por favor, inténtalo de nuevo.";
      setError(errorMessage);
      setIsLoading(false);

      toast({
        title: "Error al crear la reserva",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  return {
    createReservation,
    isLoading,
    error,
  };
};
