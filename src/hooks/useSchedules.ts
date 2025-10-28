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

        // Usar fetch directo
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${url}/rest/v1/restaurant_schedules?select=opening_time,closing_time&day_of_week=eq.${dayOfWeek}&is_active=eq.true&order=opening_time`,
          {
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
            },
          }
        );

        if (!response.ok) throw new Error('Error loading schedules');
        const data = await response.json();
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
