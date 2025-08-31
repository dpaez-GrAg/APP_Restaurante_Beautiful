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
  table_id?: string;
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

  // Generar slots de tiempo cada 30 minutos desde 12:00 hasta 23:30
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 12; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 23 && minute === 30) break; // Terminar en 23:00
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const [reservationsResult, tablesResult] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            *,
            customers(name)
          `)
          .eq('date', selectedDate)
          .in('status', ['confirmed', 'pending']),
        supabase
          .from('tables')
          .select('*')
          .eq('is_active', true)
          .order('name')
      ]);

      if (reservationsResult.error) throw reservationsResult.error;
      if (tablesResult.error) throw tablesResult.error;

      // Mapear reservaciones con nombre del cliente
      const mappedReservations = (reservationsResult.data || []).map(reservation => ({
        id: reservation.id,
        customer_name: reservation.customers?.name || 'Cliente',
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
        table_id: null // Por ahora no hay table_id en el esquema actual
      }));

      setReservations(mappedReservations);
      setTables(tablesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getReservationForTableAndTime = (tableId: string, timeSlot: string) => {
    return reservations.find(reservation => 
      reservation.table_id === tableId && 
      reservation.time.substring(0, 5) === timeSlot
    );
  };

  const needsDoubleService = (tableId: string, timeSlot: string) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    const currentReservation = getReservationForTableAndTime(tableId, timeSlot);
    
    if (!currentReservation) return false;

    // Buscar si hay otra reserva en las próximas 2-3 horas
    const nextSlots = timeSlots.filter(slot => {
      const slotHour = parseInt(slot.split(':')[0]);
      return slotHour > hour && slotHour <= hour + 3;
    });

    return nextSlots.some(slot => {
      const nextReservation = getReservationForTableAndTime(tableId, slot);
      return nextReservation && nextReservation.id !== currentReservation.id;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Vista de Ocupación por Horarios
          <Badge variant="secondary">
            {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header con horarios */}
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `120px repeat(${timeSlots.length}, 80px)` }}>
              <div className="p-2 text-sm font-medium text-center">Mesa / Hora</div>
              {timeSlots.map(time => (
                <div key={time} className="p-2 text-xs font-medium text-center border-l">
                  {time}
                </div>
              ))}
            </div>

            {/* Filas de mesas */}
            <div className="space-y-1">
              {tables.map(table => (
                <div 
                  key={table.id} 
                  className="grid gap-1 items-stretch" 
                  style={{ gridTemplateColumns: `120px repeat(${timeSlots.length}, 80px)` }}
                >
                  {/* Nombre de la mesa */}
                  <div className="p-3 bg-muted rounded text-sm font-medium flex items-center">
                    <div>
                      <div>{table.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Cap: {table.capacity}
                      </div>
                    </div>
                  </div>
                  
                  {/* Slots de tiempo para esta mesa */}
                  {timeSlots.map(timeSlot => {
                    const reservation = getReservationForTableAndTime(table.id, timeSlot);
                    const isDoubleService = needsDoubleService(table.id, timeSlot);
                    
                    return (
                      <div 
                        key={`${table.id}-${timeSlot}`}
                        className={`p-1 border-l border-b min-h-[60px] flex items-center justify-center text-xs ${
                          reservation 
                            ? isDoubleService 
                              ? 'bg-orange-100 border-orange-300' 
                              : reservation.status === 'confirmed' 
                                ? 'bg-green-100 border-green-300' 
                                : 'bg-yellow-100 border-yellow-300'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        {reservation && (
                          <div className="text-center">
                            <div className="font-medium truncate">
                              {reservation.customer_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {reservation.guests}p
                            </div>
                            {isDoubleService && (
                              <div className="text-xs text-orange-600 font-medium">
                                Doblar
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
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
                <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                <span>Libre</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReservationTimeGrid;