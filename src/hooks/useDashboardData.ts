import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  todayReservations: number;
  cancelledReservations: number;
  confirmedReservations: number;
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

export const useDashboardData = (selectedDate: string) => {
  const [stats, setStats] = useState<DashboardStats>({
    todayReservations: 0,
    cancelledReservations: 0,
    confirmedReservations: 0,
    totalTables: 0,
    occupancyRate: 0,
    totalGuests: 0,
  });

  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Cargar reservas del día seleccionado
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          *,
          customers (name, email)
        `)
        .eq('date', selectedDate);

      if (reservationsError) throw reservationsError;

      const confirmedReservations = reservations?.filter(r => r.status === 'confirmed') || [];
      const cancelledReservations = reservations?.filter(r => r.status === 'cancelled') || [];
      const totalGuests = confirmedReservations.reduce((sum, r) => sum + (r.guests || 0), 0);

      // Cargar total de mesas
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('is_active', true);

      if (tablesError) throw tablesError;

      const totalTables = tables?.length || 0;
      const occupancyRate = totalTables > 0 ? Math.round((confirmedReservations.length / totalTables) * 100) : 0;

      setStats({
        todayReservations: reservations?.length || 0,
        confirmedReservations: confirmedReservations.length,
        cancelledReservations: cancelledReservations.length,
        totalTables,
        occupancyRate,
        totalGuests,
      });

      // Mostrar las últimas 5 reservas
      const recentReservationsWithCustomers = reservations?.slice(0, 5).map(reservation => ({
        id: reservation.id,
        name: reservation.customers?.name || 'Sin nombre',
        email: reservation.customers?.email || 'Sin email',
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
      })) || [];

      setRecentReservations(recentReservationsWithCustomers);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
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