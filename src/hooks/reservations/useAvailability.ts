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
      console.log("🔍 Checking availability:", { dateStr, guests, durationMinutes });

      // Use the new function with zone information
      // @ts-ignore - Supabase types not yet updated
      const startTime = performance.now();
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_available_time_slots_with_zones", {
        p_date: dateStr,
        p_guests: guests,
        p_duration_minutes: durationMinutes,
      });
      const endTime = performance.now();
      console.log(`⏱️ RPC took ${(endTime - startTime).toFixed(0)}ms`);

      if (rpcError) {
        console.error("❌ RPC Error:", rpcError);
        throw rpcError;
      }

      console.log("✅ RPC Response:", rpcData);

      // Transform the data to match the expected format
      if (!rpcData) {
        console.warn("⚠️ RPC returned null/undefined");
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

      console.log("📋 Transformed slots:", slots.length, "slots");
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
