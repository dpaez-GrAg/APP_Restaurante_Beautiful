/**
 * Hook for checking reservation availability
 * Centralizes availability checking logic
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { TimeSlot } from "@/types/reservation";
import { formatDateLocal } from "@/lib/dateUtils";

export interface TimeSlotWithZone extends TimeSlot {
  zone_id?: string | null;
  zone_name?: string;
  zone_color?: string;
  zone_priority?: number;
}

interface UseAvailabilityOptions {
  date: Date | null;
  guests: number;
  durationMinutes?: number;
  autoCheck?: boolean; // Auto-check when date/guests change
}

interface UseAvailabilityReturn {
  availableSlots: TimeSlotWithZone[];
  isLoading: boolean;
  error: string | null;
  checkAvailability: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAvailability = ({
  date,
  guests,
  durationMinutes = 90,
  autoCheck = true,
}: UseAvailabilityOptions): UseAvailabilityReturn => {
  const [availableSlots, setAvailableSlots] = useState<TimeSlotWithZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Memoize the date string to prevent unnecessary re-renders
  const dateStr = useMemo(() => {
    return date ? formatDateLocal(date) : null;
  }, [date]);

  const checkAvailability = useCallback(async () => {
    if (!dateStr || !guests) {
      setAvailableSlots([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Usar fetch directo en lugar de supabase.rpc() debido a problemas de compatibilidad
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const rpcPromise = fetch(`${url}/rest/v1/rpc/get_available_time_slots_with_zones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          p_date: dateStr,
          p_guests: guests,
          p_duration_minutes: durationMinutes,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          return { data: null, error: { message: text } };
        }

        const data = await response.json();
        return { data, error: null };
      });

      // Timeout de 30 segundos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: La consulta tardó más de 30 segundos")), 30000)
      );

      const { data: rpcData, error: rpcError } = (await Promise.race([rpcPromise, timeoutPromise])) as any;

      if (rpcError) {
        throw rpcError;
      }

      // Transform the data to match the expected format
      if (!rpcData) {
        setAvailableSlots([]);
        return;
      }

      const slots = Array.isArray(rpcData)
        ? rpcData.map((slot: any) => ({
            id: slot.id || `${slot.slot_time}-${slot.capacity}`,
            time: slot.slot_time,
            available: true,
            capacity: slot.capacity,
            zone_id: slot.zone_id,
            zone_name: slot.zone_name,
            zone_color: slot.zone_color,
            zone_priority: slot.zone_priority,
            is_normalized: true,
          }))
        : [];

      setAvailableSlots(slots);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "No se pudo verificar la disponibilidad.";
      setError(errorMessage);
      console.error("❌ Error checking availability:", err);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, guests, durationMinutes]);

  // REMOVED: Auto-check useEffect to prevent infinite loop
  // Components should call checkAvailability manually

  return {
    availableSlots,
    isLoading,
    error,
    checkAvailability,
    refresh: checkAvailability,
  };
};
