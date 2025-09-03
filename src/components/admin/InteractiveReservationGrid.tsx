import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Plus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
interface Reservation {
  id: string;
  customer_name: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  start_at?: string;
  end_at?: string;
  duration_minutes?: number;
  email: string;
  phone?: string;
  special_requests?: string;
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
  refreshTrigger
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState<'morning' | 'evening'>('morning');

  // Generate 15-minute time slots from 12:00 to 23:30
  const generateTimeSlots = (isMobile: boolean = false) => {
    const slots = [];
    let startHour = 12;
    let endHour = 23;
    
    if (isMobile) {
      if (currentPeriod === 'morning') {
        startHour = 12;
        endHour = 17; // Until 17:45
      } else {
        startHour = 18;
        endHour = 23;
      }
    }
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 23 && minute === 45) break;
        if (isMobile && currentPeriod === 'morning' && hour === 17 && minute === 45) break;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };
  const generateHourHeaders = (isMobile: boolean = false) => {
    const headers = [];
    let startHour = 12;
    let endHour = 23;
    let baseOffset = 12;
    
    if (isMobile) {
      if (currentPeriod === 'morning') {
        startHour = 12;
        endHour = 17;
        baseOffset = 12;
      } else {
        startHour = 18;
        endHour = 23;
        baseOffset = 18;
      }
    }
    
    for (let hour = startHour; hour <= endHour; hour++) {
      headers.push({
        hour: `${hour.toString().padStart(2, '0')}h`,
        startSlotIndex: (hour - baseOffset) * 4,
        spanSlots: hour === 23 ? 2 : (isMobile && currentPeriod === 'morning' && hour === 17) ? 3 : 4
      });
    }
    return headers;
  };
  // Detect mobile viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const timeSlots = generateTimeSlots(isMobile);
  const hourHeaders = generateHourHeaders(isMobile);
  useEffect(() => {
    loadData();
  }, [selectedDate, refreshTrigger]);
  useEffect(() => {
    // Subscribe to real-time updates
    const reservationsChannel = supabase.channel('reservations-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservations'
    }, loadData).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservation_table_assignments'
    }, loadData).subscribe();
    return () => {
      supabase.removeChannel(reservationsChannel);
    };
  }, [selectedDate]);
  const loadData = async () => {
    try {
      const [reservationsResult, tablesResult, schedulesResult] = await Promise.all([supabase.from('reservations').select(`
            *,
            customers(name, email, phone),
            reservation_table_assignments(
              table_id,
              tables(name)
            )
          `).eq('date', selectedDate).in('status', ['confirmed', 'pending']), supabase.from('tables').select('*').eq('is_active', true).order('name'), supabase.from('restaurant_schedules').select('*').eq('is_active', true)]);
      if (reservationsResult.error) throw reservationsResult.error;
      if (tablesResult.error) throw tablesResult.error;
      if (schedulesResult.error) throw schedulesResult.error;
      const mappedReservations = (reservationsResult.data || []).map(reservation => ({
        id: reservation.id,
        customer_name: reservation.customers?.name || 'Cliente',
        email: reservation.customers?.email || '',
        phone: reservation.customers?.phone,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: reservation.status,
        start_at: reservation.start_at,
        end_at: reservation.end_at,
        duration_minutes: reservation.duration_minutes,
        special_requests: reservation.special_requests,
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
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };
  const isRestaurantOpen = (timeSlot: string) => {
    const currentDay = new Date(selectedDate).getDay();
    const daySchedules = schedules.filter(s => s.day_of_week === currentDay && s.is_active);
    return daySchedules.some(schedule => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot < closeTime;
    });
  };
  const getReservationForTableAndTime = (tableId: string, timeSlot: string) => {
    return reservations.find(reservation => {
      const hasTableAssigned = reservation.tableAssignments?.some(assignment => assignment.table_id === tableId);
      if (!hasTableAssigned) return false;
      if (reservation.start_at && reservation.end_at) {
        // Parse times as local time to avoid timezone conversion
        const reservationTimeStr = reservation.time.substring(0, 5); // Use time field directly
        const slotTime = timeSlot;

        // Check if the slot time matches the reservation time
        if (reservationTimeStr === slotTime) {
          return true;
        }

        // For duration-based checking, calculate if slot falls within reservation period
        const [resHour, resMinute] = reservationTimeStr.split(':').map(Number);
        const [slotHour, slotMinute] = slotTime.split(':').map(Number);
        const resStartMinutes = resHour * 60 + resMinute;
        const slotStartMinutes = slotHour * 60 + slotMinute;
        const slotEndMinutes = slotStartMinutes + 15;

        // Default duration 90 minutes if not calculable from timestamps
        let durationMinutes = reservation.duration_minutes || 90;
        if (!reservation.duration_minutes && reservation.start_at && reservation.end_at) {
          const start = new Date(reservation.start_at);
          const end = new Date(reservation.end_at);
          durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        }
        const resEndMinutes = resStartMinutes + durationMinutes;
        return resStartMinutes <= slotStartMinutes && resEndMinutes > slotStartMinutes || resStartMinutes < slotEndMinutes && resEndMinutes >= slotEndMinutes || resStartMinutes >= slotStartMinutes && resEndMinutes <= slotEndMinutes;
      }
      return reservation.time.substring(0, 5) === timeSlot;
    });
  };

  // Get reservation details with position info for rendering as single block
  const getReservationDetails = (tableId: string, timeSlot: string) => {
    const reservation = getReservationForTableAndTime(tableId, timeSlot);
    if (!reservation) return null;

    // Use the reservation.time field directly instead of start_at to avoid timezone issues
    const reservationTimeStr = reservation.time.substring(0, 5); // "14:30"
    const [resHour, resMinute] = reservationTimeStr.split(':').map(Number);

    // Calculate duration from reservation data (prefer duration_minutes, fallback to calculation)
    let durationMinutes = reservation.duration_minutes || 90;
    if (!reservation.duration_minutes && reservation.start_at && reservation.end_at) {
      const start = new Date(reservation.start_at);
      const end = new Date(reservation.end_at);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }

    // Find the starting slot index for this reservation based on time field
    const startSlotIndex = timeSlots.findIndex(slot => slot === reservationTimeStr);
    if (startSlotIndex === -1) return null;

    // Calculate duration in 15-minute slots
    const durationSlots = Math.ceil(durationMinutes / 15);

    // Check if this is the first slot of the reservation
    const currentSlotIndex = timeSlots.findIndex(slot => slot === timeSlot);
    const isFirstSlot = currentSlotIndex === startSlotIndex;
    return {
      reservation,
      isFirstSlot,
      startSlotIndex,
      durationSlots,
      currentSlotIndex
    };
  };
  const ReservationBlock = ({
    reservation
  }: {
    reservation: Reservation;
  }) => {
    return <div className="text-center w-full px-0.5">
        <div className="font-semibold text-foreground text-xs leading-tight mb-1 truncate" title={reservation.customer_name}>
          {reservation.customer_name.split(' ')[0]}
        </div>
        <div className="text-xs font-medium flex items-center justify-center gap-1">
          <Users className="w-3 h-3" />
          {reservation.guests}
        </div>
      </div>;
  };

  // Generate unique pastel color for each reservation
  const getReservationColor = (reservationId: string) => {
    // Generate a hash from the reservation ID
    let hash = 0;
    for (let i = 0; i < reservationId.length; i++) {
      const char = reservationId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use the hash to generate consistent HSL values
    const hue = Math.abs(hash) % 360;
    const saturation = 40 + Math.abs(hash) % 30; // 40-70% saturation for soft colors
    const lightness = 85 + Math.abs(hash) % 10; // 85-95% lightness for pastel tones

    return {
      backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
      borderColor: `hsl(${hue}, ${saturation + 10}%, ${lightness - 15}%)`
    };
  };

  // Current time indicator
  const getCurrentTimePosition = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Only show if within restaurant hours (12:00 - 23:30)
    if (currentHour < 12 || currentHour > 23 || currentHour === 23 && currentMinute > 30) {
      return null;
    }
    const totalMinutes = currentHour * 60 + currentMinute;
    const startMinutes = 12 * 60; // 12:00
    const endMinutes = 23 * 60 + 30; // 23:30

    const percentage = (totalMinutes - startMinutes) / (endMinutes - startMinutes) * 100;
    return Math.max(0, Math.min(100, percentage));
  };
  const currentTimePosition = getCurrentTimePosition();
  if (isLoading) {
    return <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando vista de reservas...</div>
        </CardContent>
      </Card>;
  }
  return <Card className="w-full">
      <CardHeader>
        <CardTitle className="space-y-2">
          {/* Primera línea: Título y fecha */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              Linea de tiempo
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", {
                locale: es
              })}
              </Badge>
              <Badge variant="secondary" className="sm:hidden">
                {format(parseISO(selectedDate), "d/M", {
                locale: es
              })}
              </Badge>
            </div>
            {/* Botón nueva reserva - siempre visible */}
            <Button onClick={onNewReservation} className="flex items-center gap-2" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Reserva</span>
              <span className="sm:hidden">+</span>
            </Button>
          </div>
          
          {/* Segunda línea: Navegación móvil */}
          <div className="md:hidden flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPeriod('morning')}
              className={`p-1 ${currentPeriod === 'morning' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs px-2">
              {currentPeriod === 'morning' ? '12-18h' : '18-23h'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPeriod('evening')}
              className={`p-1 ${currentPeriod === 'evening' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-x">
          {/* Header with hour markers only */}
          <div className="relative min-w-[350px] md:min-w-[800px]">
            {/* Mesa column header */}
            <div className="absolute top-0 left-0 w-[60px] md:w-[80px] h-[40px] bg-muted border flex items-center justify-center z-10">
              <span className="text-sm font-medium">Mesa</span>
            </div>
            
            {/* Hour headers spanning multiple slots */}
            <div className="ml-[60px] md:ml-[80px] relative h-[40px] border-t border-b">
              {hourHeaders.map((header, index) => <div key={header.hour} className="absolute top-0 h-full flex items-center justify-center bg-muted border-l border-r font-medium text-sm" style={{
              left: `${header.startSlotIndex / timeSlots.length * 100}%`,
              width: `${header.spanSlots / timeSlots.length * 100}%`,
              borderLeftWidth: index === 0 ? '0px' : '1px'
            }}>
                  {header.hour}
                </div>)}
              
              {/* Current time indicator */}
              {currentTimePosition !== null && <div className="absolute top-0 w-0.5 bg-red-500 z-20" style={{
              left: `${currentTimePosition}%`,
              height: `${40 + tables.length * 50}px` // Header height + all table rows
            }}>
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
                </div>}
            </div>
          </div>

          {/* Table rows with perfect alignment */}
          <div  className="relative">
            
            {tables.map(table => <div key={table.id} className="relative">
                {/* Table name column */}
                <div className="absolute left-0 top-0 w-[60px] md:w-[80px] min-h-[50px] bg-muted text-sm font-medium flex items-center border-r border-b p-2">
                  <div>
                    <div className="font-semibold text-xs">{table.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {table.capacity}p
                    </div>
                  </div>
                </div>
                
                {/* Time slots row (read-only, no overflow) */}
                <div className="ml-[60px] md:ml-[80px] relative min-h-[50px] border-b overflow-hidden">
                  {/* Background slots indicating open/closed hours (non-interactive) */}
                  <div className="absolute inset-0 pointer-events-none flex">
                    {timeSlots.map((timeSlot, idx) => {
                  const isOpen = isRestaurantOpen(timeSlot);
                  const slotWidth = 100 / timeSlots.length;
                  return <div key={`${table.id}-bg-${timeSlot}`} className={`${!isOpen ? 'bg-gray-200 border-gray-300' : 'bg-gray-50 border-gray-200'} border-r`} style={{
                    width: `${slotWidth}%`
                  }} />;
                })}
                  </div>

                  {/* Reservation blocks (absolute, precise to minutes) */}
                  {(() => {
                // Helpers for minute math
                const toMinutes = (hhmm: string) => {
                  const [h, m] = hhmm.split(':').map(Number);
                  return h * 60 + m;
                };
                let dayStart = 12 * 60; // 12:00
                let dayEnd = 23 * 60 + 30; // 23:30
                
                if (isMobile) {
                  if (currentPeriod === 'morning') {
                    dayStart = 12 * 60;
                    dayEnd = 18 * 60; // 18:00
                  } else {
                    dayStart = 18 * 60;
                    dayEnd = 23 * 60 + 30;
                  }
                }
                
                const totalRange = dayEnd - dayStart;
                const tableReservations = reservations.filter(r => r.tableAssignments?.some(a => a.table_id === table.id));
                return tableReservations.map(reservation => {
                  const reservationTimeStr = reservation.time.substring(0, 5); // HH:MM
                  let durationMinutes = reservation.duration_minutes || 90;
                  if (!reservation.duration_minutes && reservation.start_at && reservation.end_at) {
                    const start = new Date(reservation.start_at);
                    const end = new Date(reservation.end_at);
                    durationMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
                  }
                  let startMin = toMinutes(reservationTimeStr);
                  let endMin = startMin + durationMinutes;

                  // Clamp within visible range
                  startMin = Math.max(dayStart, startMin);
                  endMin = Math.min(dayEnd, endMin);
                  if (endMin <= startMin) return null;
                  const leftPct = (startMin - dayStart) / totalRange * 100;
                  const widthPct = (endMin - startMin) / totalRange * 100;
                  const reservationColors = getReservationColor(reservation.id);
                  return <div key={`res-${reservation.id}-${table.id}`} className="absolute top-0 bottom-0 border rounded-sm cursor-pointer hover:shadow-md transition-shadow" style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: reservationColors.backgroundColor,
                    borderColor: reservationColors.borderColor
                  }} title={`${reservation.customer_name} • ${reservationTimeStr} • ${reservation.guests}p`} onClick={() => onReservationClick?.(reservation)}>
                          <ReservationBlock reservation={reservation} />
                        </div>;
                });
              })()}
                </div>
              </div>)}
          </div>
        </div>
        
        {/* Legend */}
        
      </CardContent>
    </Card>;
};
export default InteractiveReservationGrid;