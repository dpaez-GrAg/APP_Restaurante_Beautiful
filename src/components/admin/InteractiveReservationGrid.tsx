import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, Users, UserCheck } from "lucide-react";
import { CLASSIFICATION_COLORS } from "@/types/customer";
import CustomerClassificationBadge from "@/components/CustomerClassificationBadge";
import CustomerDetailModal from "@/components/CustomerDetailModal";
import { Reservation, ReservationDisplay, Schedule } from "@/types/reservation";
import { Table } from "@/types/table";
import { generateTimeSlots, generateHourHeaders, minutesToSlots, getSlotIndex } from "@/lib/reservations";

interface InteractiveReservationGridProps {
  selectedDate: string;
  onRefresh: () => void;
  onReservationClick?: (reservation: Reservation) => void;
  onNewReservation?: () => void;
  refreshTrigger?: number;
}

const InteractiveReservationGrid: React.FC<InteractiveReservationGridProps> = ({
  selectedDate,
  onRefresh,
  onReservationClick,
  onNewReservation,
  refreshTrigger,
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [specialClosedDays, setSpecialClosedDays] = useState<any[]>([]);
  const [specialScheduleDays, setSpecialScheduleDays] = useState<any[]>([]);

  // Use centralized time slot generation
  const timeSlots = generateTimeSlots("12:00", "23:30", 15);
  const hourHeaders = generateHourHeaders(12, 23);

  useEffect(() => {
    loadData();
  }, [selectedDate, refreshTrigger]);

  useEffect(() => {
    // Subscribe to real-time updates
    const reservationsChannel = supabase
      .channel(`reservations-changes-${selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `date=eq.${selectedDate}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsChannel);
    };
  }, [selectedDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadReservations(), loadTables(), loadSchedules(), loadSpecialDays()]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setIsLoading(false);
    }
  };

  const loadReservations = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          `
          *,
          customers!inner(
            id,
            name,
            classification
          ),
          reservation_table_assignments(
            table_id,
            tables(name)
          )
        `
        )
        .eq("date", selectedDate)
        .neq("status", "cancelled");

      if (error) throw error;

      const formattedReservations: Reservation[] = (data || []).map((reservation: any) => ({
        id: reservation.id,
        customer_id: reservation.customers.id,
        customer_name: reservation.customers.name,
        customer_classification: reservation.customers.classification,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
        start_at: reservation.start_at,
        end_at: reservation.end_at,
        duration_minutes: reservation.duration_minutes,
        email: reservation.email,
        phone: reservation.phone,
        special_requests: reservation.special_requests,
        tableAssignments: reservation.reservation_table_assignments?.map((assignment: any) => ({
          table_id: assignment.table_id,
          table_name: assignment.tables?.name,
        })),
      }));

      setReservations(formattedReservations);
    } catch (error) {
      console.error("Error loading reservations:", error);
      throw error;
    }
  };

  const loadTables = async () => {
    try {
      const { data, error } = await supabase.from("tables").select("*").order("name");

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error("Error loading tables:", error);
      throw error;
    }
  };

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase.from("restaurant_schedules").select("*").eq("is_active", true);

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error("Error loading schedules:", error);
      throw error;
    }
  };

  const loadSpecialDays = async () => {
    try {
      const [closedDaysResult, specialSchedulesResult] = await Promise.all([
        supabase.from("special_closed_days").select("*"),
        supabase.from("special_schedule_days").select("*").eq("is_active", true),
      ]);

      if (closedDaysResult.error) throw closedDaysResult.error;
      if (specialSchedulesResult.error) throw specialSchedulesResult.error;

      setSpecialClosedDays(closedDaysResult.data || []);
      setSpecialScheduleDays(specialSchedulesResult.data || []);
    } catch (error) {
      console.error("Error loading special days:", error);
      throw error;
    }
  };

  // Calculate reservation display properties for a specific table
  const getReservationDisplays = (tableId: string): ReservationDisplay[] => {
    const tableReservations = reservations.filter((reservation) => {
      if (reservation.tableAssignments && reservation.tableAssignments.length > 0) {
        return reservation.tableAssignments.some((assignment) => assignment.table_id === tableId);
      }
      return false;
    });

    return tableReservations
      .map((reservation) => {
        const reservationTimeStr = reservation.time.substring(0, 5);
        const startSlotIndex = getSlotIndex(reservationTimeStr, timeSlots);

        // Calculate duration in 15-minute slots using centralized utility
        let durationMinutes = reservation.duration_minutes || 90;
        if (!reservation.duration_minutes && reservation.start_at && reservation.end_at) {
          const start = new Date(reservation.start_at);
          const end = new Date(reservation.end_at);
          durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        }

        const durationSlots = minutesToSlots(durationMinutes);

        return {
          ...reservation,
          startSlotIndex: Math.max(0, startSlotIndex),
          duration: durationSlots,
        };
      })
      .filter((reservation) => reservation.startSlotIndex >= 0);
  };

  // Check if restaurant is open at a specific time slot
  const isRestaurantOpen = (timeSlot: string) => {
    const currentDate = new Date(selectedDate);
    const currentDay = currentDate.getDay();
    const dateString = selectedDate; // YYYY-MM-DD format

    // 1. Check if it's a special closed day
    const isClosedDay = specialClosedDays.some((closedDay) => {
      if (closedDay.is_range && closedDay.range_start && closedDay.range_end) {
        // Range check
        const rangeStart = new Date(closedDay.range_start);
        const rangeEnd = new Date(closedDay.range_end);
        return currentDate >= rangeStart && currentDate <= rangeEnd;
      } else {
        // Single day check
        return closedDay.date === dateString;
      }
    });

    if (isClosedDay) {
      return false; // Restaurant is closed
    }

    // 2. Check if there's a special schedule for this day
    const specialSchedule = specialScheduleDays.find((schedule) => schedule.date === dateString);
    if (specialSchedule) {
      const openTime = specialSchedule.opening_time.substring(0, 5);
      const closeTime = specialSchedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot < closeTime;
    }

    // 3. Fall back to regular weekly schedule
    const daySchedules = schedules.filter((s) => s.day_of_week === currentDay && s.is_active);
    return daySchedules.some((schedule) => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot < closeTime;
    });
  };

  const ReservationBlock = ({ reservation }: { reservation: ReservationDisplay }) => {
    const handleCustomerClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedCustomerId(reservation.customer_id);
    };

    const handleReservationClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onReservationClick?.(reservation);
    };

    return (
      <div
        className="h-full rounded px-1.5 py-0.5 cursor-pointer hover:shadow-md transition-all border-2 flex flex-col justify-center"
        style={getReservationColor(reservation)}
        onClick={handleReservationClick}
        title={`${reservation.customer_name} - ${reservation.guests} personas - ${
          reservation.customer_classification || "NEUTRO"
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9px] font-bold text-foreground/70">{reservation.time.substring(0, 5)}</span>
          <div className="flex items-center gap-1 text-[10px] font-medium text-foreground/80">
            <Users className="w-3 h-3" />
            {reservation.guests}
          </div>
        </div>
        <button
          onClick={handleCustomerClick}
          className="font-semibold text-[11px] leading-none truncate hover:underline text-left"
          title={`Click para ver detalles de ${reservation.customer_name}`}
        >
          {reservation.customer_name.split(" ")[0]}
        </button>
      </div>
    );
  };

  // Get reservation color based on customer classification
  const getReservationColor = (reservation: Reservation) => {
    const classification = reservation.customer_classification || "NEUTRO";
    const baseColor = CLASSIFICATION_COLORS[classification];

    // Convert hex to HSL for lighter background
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0,
        s = 0,
        l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return { h: h * 360, s: s * 100, l: l * 100 };
    };

    const hsl = hexToHsl(baseColor);

    return {
      backgroundColor: `hsl(${hsl.h}, ${hsl.s}%, 90%)`,
      borderColor: baseColor,
    };
  };

  // Current time indicator
  const getCurrentTimePosition = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Only show if within restaurant hours (12:00 - 23:30)
    if (currentHour < 12 || currentHour > 23 || (currentHour === 23 && currentMinute > 30)) {
      return null;
    }

    const totalMinutes = currentHour * 60 + currentMinute;
    const startMinutes = 12 * 60; // 12:00
    const endMinutes = 23 * 60 + 30; // 23:30

    const percentage = ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const currentTimePosition = getCurrentTimePosition();

  const handleCustomerUpdated = () => {
    // Reload reservations to get updated customer data
    loadData();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando vista de reservas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                Vista de Reservas - {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es })}
              </CardTitle>
              {onNewReservation && (
                <Button onClick={onNewReservation} size="sm" className="ml-4">
                  <Plus className="w-4 h-4 mr-1" />
                  Nueva Reserva
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px] relative">
              {/* Hour headers */}
              <div className="grid grid-cols-[120px_1fr] border-b">
                <div className="p-2 bg-muted font-medium text-center">Mesa</div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)` }}>
                  {hourHeaders.map((header) => (
                    <div
                      key={header.hour}
                      className="p-2 bg-muted font-medium text-center border-l text-xs"
                      style={{ gridColumn: `span ${header.spanSlots}` }}
                    >
                      {header.hour}
                    </div>
                  ))}
                </div>
              </div>

              {/* Current time indicator */}
              {currentTimePosition !== null && (
                <div
                  className="absolute top-12 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                  style={{ left: `calc(120px + ${currentTimePosition}%)` }}
                >
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full"></div>
                </div>
              )}

              {/* Table rows */}
              {tables.map((table) => {
                const reservationDisplays = getReservationDisplays(table.id);

                return (
                  <div key={table.id} className="grid grid-cols-[120px_1fr] border-b hover:bg-muted/50">
                    <div className="p-2 font-medium flex items-center justify-between border-r">
                      <span className="text-sm">{table.name}</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span className="text-xs">{table.capacity}</span>
                      </div>
                    </div>
                    <div
                      className="relative min-h-[45px]"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)`,
                      }}
                    >
                      {/* Background slots indicating open/closed hours */}
                      {timeSlots.map((slot, index) => {
                        const isOpen = isRestaurantOpen(slot);
                        return (
                          <div
                            key={slot}
                            className={`border-l border-muted ${!isOpen ? "bg-gray-200" : "bg-gray-50"}`}
                          />
                        );
                      })}

                      {/* Reservation blocks positioned absolutely */}
                      {reservationDisplays.map((reservation) => (
                        <div
                          key={reservation.id}
                          className="absolute top-1 bottom-1"
                          style={{
                            left: `${(reservation.startSlotIndex / timeSlots.length) * 100}%`,
                            width: `${(reservation.duration / timeSlots.length) * 100}%`,
                            paddingLeft: "2px",
                            paddingRight: "2px",
                          }}
                        >
                          <ReservationBlock reservation={reservation} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          isOpen={!!selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onCustomerUpdated={handleCustomerUpdated}
        />
      )}
    </>
  );
};

export default InteractiveReservationGrid;
