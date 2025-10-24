import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ReservationListItem } from "@/lib/reservationsUtils";

export const useReservations = () => {
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);
  const { toast } = useToast();

  const loadReservations = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: reservationData, error } = await supabase
        .from("reservations")
        .select(
          `
          *,
          customers (name, email, phone),
          reservation_table_assignments (
            table_id,
            tables (name)
          )
        `
        )
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (error) throw error;

      const formattedReservations: ReservationListItem[] =
        reservationData?.map((reservation) => ({
          id: reservation.id,
          name: reservation.customers?.name || "Sin nombre",
          email: reservation.customers?.email || "Sin email",
          phone: reservation.customers?.phone || undefined,
          date: reservation.date,
          time: reservation.time,
          guests: reservation.guests,
          message: reservation.special_requests || undefined,
          status: reservation.status as "pending" | "confirmed" | "cancelled" | "arrived",
          table_assignments:
            reservation.reservation_table_assignments?.map((assignment) => ({
              table_id: assignment.table_id,
              table_name: assignment.tables?.name,
            })) || [],
          created_at: reservation.created_at,
          duration_minutes: reservation.duration_minutes,
          start_at: reservation.start_at,
          end_at: reservation.end_at,
        })) || [];

      setReservations(formattedReservations);
    } catch (error) {
      console.error("Error loading reservations:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las reservas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Set up realtime subscription
  useEffect(() => {
    loadReservations();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
        },
        loadReservations
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservation_table_assignments",
        },
        loadReservations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReservations]);

  const updateReservationStatus = async (
    id: string,
    newStatus: "confirmed" | "cancelled" | "arrived"
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === id ? { ...reservation, status: newStatus } : reservation
        )
      );

      setGridRefreshKey((prev) => prev + 1);

      toast({
        title: "Estado actualizado",
        description: `Reserva ${
          newStatus === "confirmed" ? "confirmada" : newStatus === "cancelled" ? "cancelada" : "llegada"
        } correctamente.`,
      });

      return true;
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la reserva.",
        variant: "destructive",
      });
      return false;
    }
  };

  const confirmArrival = async (id: string): Promise<boolean> => {
    return updateReservationStatus(id, "arrived");
  };

  const refreshGrid = () => {
    setGridRefreshKey((prev) => prev + 1);
  };

  return {
    reservations,
    isLoading,
    gridRefreshKey,
    loadReservations,
    updateReservationStatus,
    confirmArrival,
    refreshGrid,
  };
};
