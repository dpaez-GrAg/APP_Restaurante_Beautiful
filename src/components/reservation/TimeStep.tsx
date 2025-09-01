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
      // Get restaurant schedules for the selected day
      const dayOfWeek = date.getDay();
      const { data: schedules, error: schedulesError } = await supabase
        .from('restaurant_schedules')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true);

      if (schedulesError) throw schedulesError;

      if (!schedules || schedules.length === 0) {
        setAvailableSlots([]);
        return;
      }

      // Get all time slots
      const { data: timeSlots, error: slotsError } = await supabase
        .from('time_slots')
        .select('*')
        .order('time');

      if (slotsError) throw slotsError;

      // Get existing reservations for the selected date
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('time, guests')
        .eq('date', format(date, 'yyyy-MM-dd'));

      if (reservationsError) throw reservationsError;

      // Filter time slots to only include those within opening hours
      const validSlots = timeSlots?.filter(slot => {
        const slotTime = slot.time;
        return schedules.some(schedule => 
          slotTime >= schedule.opening_time && slotTime <= schedule.closing_time
        );
      }) || [];

      // Calculate availability and filter out past times
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
      const selectedDateStr = format(date, 'yyyy-MM-dd');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const isToday = selectedDateStr === todayStr;

      const slots: TimeSlot[] = validSlots
        .filter(slot => {
          // If it's today, filter out past times
          if (isToday) {
            const [hours, minutes] = slot.time.split(':').map(Number);
            const slotTimeInMinutes = hours * 60 + minutes;
            return slotTimeInMinutes > currentTime;
          }
          return true;
        })
        .map(slot => {
          const reservedGuests = reservations
            ?.filter(r => r.time === slot.time)
            ?.reduce((sum, r) => sum + r.guests, 0) || 0;
          
          const availableCapacity = slot.max_capacity - reservedGuests;
          
          return {
            id: slot.id,
            time: slot.time,
            available: availableCapacity >= guests,
            capacity: availableCapacity
          };
        });

      setAvailableSlots(slots);
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

  const brunchSlots = availableSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 11 && hour < 13;
  });

  const lunchSlots = availableSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 13 && hour < 16;
  });

  const dinnerSlots = availableSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 19;
  });

  const dinnerFirstSlots = dinnerSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 19 && hour < 21;
  });

  const dinnerSecondSlots = dinnerSlots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    return hour >= 21;
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
          {/* Brunch */}
          {brunchSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">Brunch</h3>
              {brunchSlots.some(slot => slot.available) ? (
                <div className="grid grid-cols-3 gap-2">
                  {brunchSlots.map((slot) => (
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

          {/* Lunch */}
          {lunchSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">Comida Primer Turno</h3>
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

          {/* Dinner */}
          <div>
            <h3 className="font-medium text-sm mb-3">Cena</h3>
            {dinnerFirstSlots.some(slot => slot.available) ? (
              <div className="grid grid-cols-3 gap-2">
                {dinnerFirstSlots.map((slot) => (
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

          {/* Dinner Second Turn */}
          {dinnerSecondSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">CENA PRIMER TURNO</h3>
              <p className="text-sm text-gray-500 mb-3">Servicio no disponible: selecciona otro servicio o fecha</p>
            </div>
          )}

          {dinnerSecondSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">CENA SEGUNDO TURNO</h3>
              <p className="text-sm text-gray-500 mb-3">Servicio no disponible: selecciona otro servicio o fecha</p>
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