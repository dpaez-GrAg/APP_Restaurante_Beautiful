import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StepHeader from "./StepHeader";
import { format } from "date-fns";

interface TimeStepProps {
  date: Date;
  guests: number;
  onNext: (time: string) => void;
  onBack: () => void;
  selectedDate?: Date;
  selectedGuests?: number;
  onStepClick?: (step: 'date' | 'guests' | 'time') => void;
}

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  capacity: number;
}

const TimeStep = ({ date, guests, onNext, onBack, selectedDate, selectedGuests, onStepClick }: TimeStepProps) => {
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAvailability();
  }, [date, guests]);

  const checkAvailability = async () => {
    setLoading(true);
    try {
      // Helper function to format date as YYYY-MM-DD in local timezone
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const dateStr = formatDateLocal(date);
      
      // Get restaurant schedules
      const { data: schedules, error: schedulesError } = await supabase
        .from('restaurant_schedules')
        .select('*')
        .eq('is_active', true);

      if (schedulesError) throw schedulesError;

      // Get special closed days
      const { data: specialClosedDays, error: closedDaysError } = await supabase
        .from('special_closed_days')
        .select('*');

      if (closedDaysError) throw closedDaysError;

      // Get special schedules
      const { data: specialSchedules, error: specialSchedulesError } = await supabase
        .from('special_schedule_days')
        .select('*')
        .eq('is_active', true);

      if (specialSchedulesError) throw specialSchedulesError;

      // Check if date is closed
      const isClosed = specialClosedDays?.some(closedDay => {
        if (closedDay.is_range) {
          return closedDay.range_start && closedDay.range_end &&
                 dateStr >= closedDay.range_start && 
                 dateStr <= closedDay.range_end;
        } else {
          return closedDay.date === dateStr;
        }
      });

      if (isClosed) {
        setAvailableSlots([]);
        return;
      }

      // Get all time slots
      const { data: timeSlots, error: timeSlotsError } = await supabase
        .from('time_slots')
        .select('*')
        .order('time');

      if (timeSlotsError) throw timeSlotsError;

      // Get active tables to calculate total capacity
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('is_active', true);

      if (tablesError) throw tablesError;

      // Get existing reservations and their table assignments for the selected date
      const { data: existingReservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          time, guests, status, start_at, end_at,
          reservation_table_assignments!inner(table_id)
        `)
        .eq('date', dateStr)
        .neq('status', 'cancelled');

      if (reservationsError) throw reservationsError;

      // Check restaurant schedule (regular vs special)
      const specialSchedule = specialSchedules?.find(s => s.date === dateStr);
      const dayOfWeek = date.getDay();
      const restaurantSchedules = schedules?.filter(s => s.day_of_week === dayOfWeek) || [];
      
      let filteredSlots: any[] = [];
      
      if (specialSchedule) {
        // Use special schedule
        filteredSlots = timeSlots?.filter(slot => {
          const slotTime = slot.time;
          return slotTime >= specialSchedule.opening_time && slotTime < specialSchedule.closing_time;
        }) || [];
      } else if (restaurantSchedules.length > 0) {
        // Handle multiple schedules for the same day (e.g., lunch and dinner)
        filteredSlots = timeSlots?.filter(slot => {
          const slotTime = slot.time;
          return restaurantSchedules.some(schedule => 
            slotTime >= schedule.opening_time && slotTime < schedule.closing_time
          );
        }) || [];
      } else {
        setAvailableSlots([]);
        return;
      }

      // Filter out past times if the selected date is today
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
        filteredSlots = filteredSlots.filter(slot => slot.time > currentTime);
      }

      // Calculate availability for each slot based on actual table capacity
      const slotsWithAvailability = filteredSlots.map(slot => {
        const slotStartTime = new Date(`${dateStr}T${slot.time}:00`);
        const slotEndTime = new Date(slotStartTime.getTime() + 120 * 60000); // 2 hours
        
        // Find overlapping reservations
        const overlappingReservations = existingReservations?.filter(reservation => {
          if (!reservation.start_at || !reservation.end_at) return false;
          
          const reservationStart = new Date(reservation.start_at);
          const reservationEnd = new Date(reservation.end_at);
          
          // Check for time overlap
          return (
            (reservationStart <= slotStartTime && reservationEnd > slotStartTime) ||
            (reservationStart < slotEndTime && reservationEnd >= slotEndTime) ||
            (reservationStart >= slotStartTime && reservationEnd <= slotEndTime)
          );
        }) || [];
        
        // Calculate occupied table capacity
        const occupiedTableIds = new Set();
        overlappingReservations.forEach(reservation => {
          reservation.reservation_table_assignments?.forEach((assignment: any) => {
            occupiedTableIds.add(assignment.table_id);
          });
        });
        
        // Calculate available capacity from unoccupied tables
        const availableTables = tables?.filter(table => !occupiedTableIds.has(table.id)) || [];
        const totalAvailableCapacity = availableTables.reduce((sum, table) => sum + table.capacity, 0);
        
        return {
          id: slot.id,
          time: slot.time,
          available: totalAvailableCapacity >= guests,
          capacity: totalAvailableCapacity
        };
      });

      setAvailableSlots(slotsWithAvailability);
    } catch (error) {
      console.error('Error checking availability:', error);
      toast({
        title: "Error",
        description: "No se pudo verificar la disponibilidad.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  // Categorize slots into Comida (lunch) and Cena (dinner)
  const lunchSlots = availableSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 12 && hour < 17; // 12:00 to 16:59
  });

  const dinnerSlots = availableSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 19; // 19:00 onwards
  });

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <StepHeader 
          currentStep="time" 
          selectedDate={selectedDate || date} 
          selectedGuests={selectedGuests || guests}
          onStepClick={onStepClick}
        />
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center">
            <p className="text-muted-foreground">Verificando disponibilidad...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <StepHeader 
        currentStep="time" 
        selectedDate={selectedDate || date} 
        selectedGuests={selectedGuests || guests}
        onStepClick={onStepClick}
      />
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-primary mb-6">Selecciona una hora</h2>
        
        <div className="space-y-6">
          {/* Comida */}
          {lunchSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">COMIDA</h3>
              {lunchSlots.some(slot => slot.available) ? (
                <div className="grid grid-cols-3 gap-2">
                  {lunchSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant="outline"
                      className={`h-12 ${
                        !slot.available 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-black hover:text-white'
                      }`}
                      disabled={!slot.available}
                      onClick={() => onNext(slot.time)}
                    >
                      {formatTime(slot.time)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Servicio no disponible: selecciona otro servicio o fecha</p>
              )}
            </div>
          )}

          {/* Cena */}
          {dinnerSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">CENA</h3>
              {dinnerSlots.some(slot => slot.available) ? (
                <div className="grid grid-cols-3 gap-2">
                  {dinnerSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant="outline"
                      className={`h-12 ${
                        !slot.available 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-black hover:text-white'
                      }`}
                      disabled={!slot.available}
                      onClick={() => onNext(slot.time)}
                    >
                      {formatTime(slot.time)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Servicio no disponible: selecciona otro servicio o fecha</p>
              )}
            </div>
          )}
          
          {/* No slots available */}
          {lunchSlots.length === 0 && dinnerSlots.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay horarios disponibles para esta fecha</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={onBack} className="text-primary">
            ← Volver
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TimeStep;