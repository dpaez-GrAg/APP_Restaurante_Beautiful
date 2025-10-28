import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { calculateReservationMetrics } from "@/lib/reservationsUtils";

interface DashboardStats {
  todayReservations: number;
  cancelledReservations: number;
  confirmedReservations: number;
  completedReservations: number;
  totalTables: number;
  occupancyRate: number;
  totalGuests: number;
}

interface RecentReservation {
  id: string;
  name: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  email: string;
}

// Datos mock para cuando no hay datos reales
const mockStats: DashboardStats = {
  todayReservations: 0,
  cancelledReservations: 0,
  confirmedReservations: 0,
  completedReservations: 0,
  totalTables: 0,
  occupancyRate: 0,
  totalGuests: 0,
};

const mockReservations: RecentReservation[] = [];

export const useDashboardData = (selectedDate: string) => {
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>(mockReservations);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Usar fetch directo
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Cargar reservas del día seleccionado
      const reservationsResponse = await fetch(
        `${url}/rest/v1/reservations?select=*,customers(name,email)&date=eq.${selectedDate}`,
        {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
          },
        }
      );

      if (!reservationsResponse.ok) {
        setStats(mockStats);
        setRecentReservations(mockReservations);
        setIsLoading(false);
        return;
      }

      const reservations = await reservationsResponse.json();

      // Usar función centralizada para calcular métricas
      const metrics = calculateReservationMetrics(reservations || []);

      // Cargar total de mesas
      const tablesResponse = await fetch(
        `${url}/rest/v1/tables?select=*&is_active=eq.true`,
        {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
          },
        }
      );

      const tables = tablesResponse.ok ? await tablesResponse.json() : [];
      const totalTables = tables?.length || 0;
      const occupancyRate = totalTables > 0 ? Math.round((metrics.active / totalTables) * 100) : 0;

      setStats({
        todayReservations: metrics.total,
        confirmedReservations: metrics.confirmed,
        cancelledReservations: metrics.cancelled,
        completedReservations: 0, // No se usa en el cálculo actual
        totalTables,
        occupancyRate,
        totalGuests: metrics.totalGuests,
      });

      // Mostrar las últimas 5 reservas
      const recentReservationsWithCustomers =
        reservations?.slice(0, 5).map((reservation) => ({
          id: reservation.id,
          name: reservation.customers?.name || "Sin nombre",
          email: reservation.customers?.email || "Sin email",
          date: reservation.date,
          time: reservation.time,
          guests: reservation.guests,
          status: reservation.status,
        })) || [];

      setRecentReservations(recentReservationsWithCustomers);
    } catch (error) {
      // console.log("Error loading dashboard data, using mock data:", error);
      setStats(mockStats);
      setRecentReservations(mockReservations);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate]);

  return {
    stats,
    recentReservations,
    isLoading,
    refetch: loadDashboardData,
  };
};
