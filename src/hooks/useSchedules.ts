import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Schedule {
  opening_time: string;
  closing_time: string;
}

export const useSchedules = (dateFilter: string) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        const date = new Date(dateFilter + "T12:00:00");
        const dayOfWeek = date.getDay();

        const { data, error } = await supabase
          .from("restaurant_schedules")
          .select("opening_time, closing_time")
          .eq("day_of_week", dayOfWeek)
          .eq("is_active", true)
          .order("opening_time");

        if (error) throw error;
        setSchedules(data || []);
      } catch (error) {
        console.error("Error loading schedules:", error);
        setSchedules([]);
      }
    };

    loadSchedules();
  }, [dateFilter]);

  const isSplitSchedule = () => schedules.length > 1;

  return {
    schedules,
    isSplitSchedule,
  };
};
