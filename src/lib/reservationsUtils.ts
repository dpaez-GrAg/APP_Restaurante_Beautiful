// Utility functions for reservations management

/**
 * Calcula las métricas de reservas para un conjunto de datos
 * Esta función centraliza la lógica de cálculo para evitar duplicación
 */
export const calculateReservationMetrics = (reservations: any[]) => {
  const activeReservations = reservations.filter((r) => r.status !== "cancelled");
  const confirmedReservations = reservations.filter((r) => r.status === "confirmed");
  const arrivedReservations = reservations.filter((r) => r.status === "arrived");
  const cancelledReservations = reservations.filter((r) => r.status === "cancelled");
  
  return {
    total: reservations.length,
    active: activeReservations.length,
    confirmed: confirmedReservations.length,
    arrived: arrivedReservations.length,
    cancelled: cancelledReservations.length,
    totalGuests: activeReservations.reduce((sum, r) => sum + (r.guests || 0), 0),
  };
};

export interface ReservationListItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  guests: number;
  message?: string;
  status: "pending" | "confirmed" | "cancelled" | "arrived";
  table_assignments?: Array<{
    table_id: string;
    table_name?: string;
  }>;
  created_at: string;
  duration_minutes?: number;
  start_at?: string;
  end_at?: string;
}

export const getStatusBadgeClass = (status: string): { text: string; className: string } => {
  switch (status) {
    case "confirmed":
      return { text: "Confirmada", className: "bg-green-100 text-green-800 border-green-200" };
    case "pending":
      return { text: "Pendiente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    case "cancelled":
      return { text: "Cancelada", className: "bg-red-100 text-red-800 border-red-200" };
    case "arrived":
      return { text: "Llegada", className: "bg-blue-100 text-blue-800 border-blue-200" };
    default:
      return { text: status, className: "" };
  }
};

export const getStatusCount = (reservations: ReservationListItem[], dateFilter: string, status: string) => {
  const dateFilteredReservations = reservations.filter((r) => r.date === dateFilter);
  if (status === "all") {
    return dateFilteredReservations.length;
  }
  return dateFilteredReservations.filter((r) => r.status === status).length;
};

export const getReservationsForTimeRange = (
  reservations: ReservationListItem[],
  dateFilter: string,
  startTime: string,
  endTime: string
) => {
  return reservations.filter((r) => {
    if (r.date !== dateFilter) return false;
    const reservationTime = r.time;
    // Usar <= para incluir reservas exactamente a la hora de cierre
    return reservationTime >= startTime && reservationTime <= endTime;
  });
};

export interface ShiftMetrics {
  reservations: number;
  guests: number;
  arrived: number;
  cancelled: number;
}

export const getMetricsForShift = (
  reservations: ReservationListItem[],
  dateFilter: string,
  schedules: Array<{ opening_time: string; closing_time: string }>,
  shiftIndex: number
): ShiftMetrics => {
  if (schedules.length === 0 || !schedules[shiftIndex]) {
    return { reservations: 0, guests: 0, arrived: 0, cancelled: 0 };
  }

  const schedule = schedules[shiftIndex];
  const shiftReservations = getReservationsForTimeRange(
    reservations,
    dateFilter,
    schedule.opening_time,
    schedule.closing_time
  );

  // Usar función centralizada para calcular métricas
  const metrics = calculateReservationMetrics(shiftReservations);

  return {
    reservations: metrics.active,
    guests: metrics.totalGuests,
    arrived: metrics.arrived,
    cancelled: metrics.cancelled,
  };
};

export const getTotalMetrics = (
  reservations: ReservationListItem[],
  dateFilter: string
): ShiftMetrics => {
  const dateFilteredReservations = reservations.filter((r) => r.date === dateFilter);
  
  // Usar función centralizada para calcular métricas
  const metrics = calculateReservationMetrics(dateFilteredReservations);
  
  return {
    reservations: metrics.active,
    guests: metrics.totalGuests,
    arrived: metrics.arrived,
    cancelled: metrics.cancelled,
  };
};

export const filterReservations = (
  reservations: ReservationListItem[],
  searchTerm: string,
  statusFilter: string,
  dateFilter: string
): ReservationListItem[] => {
  let filtered = [...reservations];

  // Filtro por búsqueda
  if (searchTerm) {
    filtered = filtered.filter(
      (reservation) =>
        reservation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reservation.phone?.includes(searchTerm)
    );
  }

  // Filtro por estado
  if (statusFilter !== "all") {
    filtered = filtered.filter((reservation) => reservation.status === statusFilter);
  }

  // Filtro por fecha
  if (dateFilter) {
    filtered = filtered.filter((reservation) => reservation.date === dateFilter);
  }

  return filtered;
};
