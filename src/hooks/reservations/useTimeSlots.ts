/**
 * Hook for managing time slots with schedules
 * Centralizes schedule loading and time slot generation
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Schedule } from "@/types/reservation";
import { generateTimeSlotsFromSchedules } from "@/lib/reservations/timeSlots";

interface UseTimeSlotsOptions {
  date: string | Date;
  autoLoad?: boolean;
}

interface UseTimeSlotsReturn {
  schedules: Schedule[];
  timeSlots: string[];
  isLoading: boolean;
  error: string | null;
  loadSchedules: () => Promise<void>;
  isRestaurantOpen: (timeSlot: string) => boolean;
}

export const useTimeSlots = ({
  date,
  autoLoad = true,
}: UseTimeSlotsOptions): UseTimeSlotsReturn => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
      const dayOfWeek = dateObj.getDay();

      const { data, error: scheduleError } = await supabase
        .from("restaurant_schedules")
        .select("opening_time, closing_time, day_of_week, is_active")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .order("opening_time");

      if (scheduleError) throw scheduleError;

      const fetchedSchedules = (data as Schedule[]) || [];
      setSchedules(fetchedSchedules);

      // Generate time slots from schedules
      const slots = generateTimeSlotsFromSchedules(fetchedSchedules);
      setTimeSlots(slots);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar horarios";
      setError(errorMessage);
      console.error("Error loading schedules:", err);
      setSchedules([]);
      setTimeSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const isRestaurantOpen = (timeSlot: string): boolean => {
    return schedules.some((schedule) => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot < closeTime;
    });
  };

  useEffect(() => {
    if (autoLoad && date) {
      loadSchedules();
    }
  }, [date, autoLoad]);

  return {
    schedules,
    timeSlots,
    isLoading,
    error,
    loadSchedules,
    isRestaurantOpen,
  };
};
