import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Reservation {
  id: string;
  customer_name: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  start_at?: string;
  end_at?: string;
  tableAssignments?: Array<{
    table_id: string;
    table_name: string;
  }>;
}

interface Table {
  id: string;
  name: string;
  capacity: number;
}

const ReservationTimeGrid = ({ selectedDate }: { selectedDate: string }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generar slots de tiempo cada 15 minutos desde 12:00 hasta 23:45
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 12; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 23 && minute === 45) break; // Terminar en 23:30
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  // Generar headers de horas (solo horas en punto)
  const generateHourHeaders = () => {
    const hours = [];
    for (let hour = 12; hour <= 23; hour++) {
      hours.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return hours;
  };

  const timeSlots = generateTimeSlots();
  const hourHeaders = generateHourHeaders();

  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const [reservationsResult, tablesResult, schedulesResult] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            *,
            customers(name),
            reservation_table_assignments(
              table_id,
              tables(name)
            )
          `)
          .eq('date', selectedDate)
          .in('status', ['confirmed', 'pending']),
        supabase
          .from('tables')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('restaurant_schedules')
          .select('*')
          .eq('is_active', true)
      ]);

      if (reservationsResult.error) throw reservationsResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (schedulesResult.error) throw schedulesResult.error;

      // Mapear reservaciones con nombre del cliente y asignaciones de mesa
      const mappedReservations = (reservationsResult.data || []).map(reservation => ({
        id: reservation.id,
        customer_name: reservation.customers?.name || 'Cliente',
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
        start_at: reservation.start_at,
        end_at: reservation.end_at,
        tableAssignments: reservation.reservation_table_assignments?.map(assignment => ({
          table_id: assignment.table_id,
          table_name: assignment.tables?.name || 'Mesa'
        })) || []
      }));

      setReservations(mappedReservations);
      setTables(tablesResult.data || []);
      setSchedules(schedulesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar si el restaurante está abierto en un día y hora específicos
  const isRestaurantOpen = (timeSlot: string) => {
    const currentDay = new Date(selectedDate).getDay(); // 0 = domingo, 1 = lunes, etc.
    const daySchedules = schedules.filter(s => s.day_of_week === currentDay && s.is_active);
    
    return daySchedules.some(schedule => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot <= closeTime;
    });
  };

  const getReservationForTableAndTime = (tableId: string, timeSlot: string) => {
    return reservations.find(reservation => {
      // Check if this reservation has this table assigned
      const hasTableAssigned = reservation.tableAssignments?.some(
        assignment => assignment.table_id === tableId
      );
      
      if (!hasTableAssigned) {
        return false;
      }

      // Check time overlap using start_at and end_at if available
      if (reservation.start_at && reservation.end_at) {
        const slotStartTime = new Date(`${selectedDate}T${timeSlot}:00`);
        const slotEndTime = new Date(slotStartTime.getTime() + 15 * 60000); // 15 minute slot
        
        const reservationStart = new Date(reservation.start_at);
        const reservationEnd = new Date(reservation.end_at);
        
        return (
          (reservationStart <= slotStartTime && reservationEnd > slotStartTime) ||
          (reservationStart < slotEndTime && reservationEnd >= slotEndTime) ||
          (reservationStart >= slotStartTime && reservationEnd <= slotEndTime)
        );
      }
      
      // Fallback to time comparison
      return reservation.time.substring(0, 5) === timeSlot;
    });
  };

  const needsDoubleService = (tableId: string, timeSlot: string) => {
    const currentReservation = getReservationForTableAndTime(tableId, timeSlot);
    if (!currentReservation || !currentReservation.start_at || !currentReservation.end_at) return false;

    const reservationStart = new Date(currentReservation.start_at);
    const reservationEnd = new Date(currentReservation.end_at);
    
    // Check if there's another reservation for the same table within 3 hours after this one ends
    const threeHoursAfter = new Date(reservationEnd.getTime() + 3 * 60 * 60000);
    
    return reservations.some(reservation => {
      if (reservation.id === currentReservation.id) {
        return false;
      }
      
      const hasTableAssigned = reservation.tableAssignments?.some(
        assignment => assignment.table_id === tableId
      );
      
      if (!hasTableAssigned || !reservation.start_at) return false;
      
      const nextReservationStart = new Date(reservation.start_at);
      return nextReservationStart >= reservationEnd && nextReservationStart <= threeHoursAfter;
    });
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Vista de Ocupación por Horarios
          <Badge variant="secondary">
            {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="w-full">
          <div className="grid gap-0 mb-2" style={{ 
            gridTemplateColumns: `100px repeat(${hourHeaders.length}, minmax(40px, 1fr))`,
            maxWidth: '100%'
          }}>
            <div className="p-2 text-sm font-medium text-center bg-muted border">Mesa</div>
            {hourHeaders.map(time => (
              <div key={time} className="p-1 text-xs font-medium text-center bg-muted border-l border-t border-b">
                {time.substring(0, 2)}h
              </div>
            ))}
          </div>

          {/* Filas de mesas */}
          <div>
            {tables.map(table => (
              <div 
                key={table.id} 
                className="grid gap-0 border-b" 
                style={{ 
                  gridTemplateColumns: `100px repeat(${timeSlots.length}, minmax(10px, 1fr))`,
                  maxWidth: '100%'
                }}
              >
                {/* Nombre de la mesa */}
                <div className="p-2 bg-muted text-sm font-medium flex items-center border-r border-b">
                  <div>
                    <div className="font-semibold text-xs">{table.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {table.capacity}p
                    </div>
                  </div>
                </div>
                
                {/* Slots de tiempo para esta mesa */}
                {timeSlots.map(timeSlot => {
                  const reservation = getReservationForTableAndTime(table.id, timeSlot);
                  const isDoubleService = needsDoubleService(table.id, timeSlot);
                  const isOpen = isRestaurantOpen(timeSlot);
                  
                  return (
                    <div 
                      key={`${table.id}-${timeSlot}`}
                      className={`border-b border-r min-h-[50px] flex items-center justify-center text-xs transition-colors ${
                        !isOpen 
                          ? 'bg-gray-200 border-gray-300' // Cerrado
                          : reservation 
                            ? isDoubleService 
                              ? 'bg-orange-100 border-orange-300' 
                              : reservation.status === 'confirmed' 
                                ? 'bg-green-100 border-green-300' 
                                : 'bg-yellow-100 border-yellow-300'
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200' // Abierto pero libre
                      }`}
                    >
                      {reservation && (
                        <div className="text-center w-full px-0.5">
                          <div className="font-semibold text-foreground text-xs leading-tight mb-1 truncate" title={reservation.customer_name}>
                            {reservation.customer_name.split(' ')[0]}
                          </div>
                          <div className="text-xs font-medium">
                            {reservation.guests}p
                          </div>
                          {isDoubleService && (
                            <div className="text-xs text-orange-700 font-bold">
                              ↻
                            </div>
                          )}
                        </div>
                      )}
                      {!reservation && !isOpen && (
                        <div className="text-xs text-gray-500">✕</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Confirmada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
            <span>Doblar Mesa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
            <span>Cerrado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
            <span>Libre</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReservationTimeGrid;