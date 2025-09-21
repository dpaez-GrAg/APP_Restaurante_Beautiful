import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
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
    // console.log('🔍 Checking availability for:', { date, guests });
    try {
      // Helper function to format date as YYYY-MM-DD in local timezone
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const dateStr = formatDateLocal(date);
      // console.log('📅 Formatted date:', dateStr);

      // Use supabase.rpc instead of fetch
      const { data: rpcData, error } = await supabase.rpc('get_available_time_slots' as any, {
        p_date: dateStr,
        p_guests: guests,
        p_duration_minutes: 90
      });

      if (error) {
        console.error('RPC Error:', error);
        throw new Error(`RPC call failed: ${error.message}`);
      }

      // console.log('📋 Available time slots from RPC:', rpcData);

      // Transform the data to match the expected format
      const slots = Array.isArray(rpcData) ? rpcData.map((slot: any) => ({
        id: slot.id,
        time: slot.slot_time, // Use slot_time from the RPC function
        available: true,
        capacity: slot.capacity
      })) : [];

      // console.log('🔄 Transformed slots:', slots);

      // Filter out past times for today
      const now = new Date();
      const today = formatDateLocal(now);
      const currentTime = now.toTimeString().slice(0, 8);

      const filteredSlots = slots.filter((slot: any) => {
        if (dateStr === today) {
          return slot.time > currentTime;
        }
        return true;
      });

      // console.log('✅ Available slots after filtering past times:', filteredSlots.length);
      setAvailableSlots(filteredSlots);
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
              <div className="grid grid-cols-3 gap-2">
                {lunchSlots.map((slot) => (
                  <Button
                    key={slot.id}
                    variant="outline"
                    className="h-12 hover:bg-black hover:text-white"
                    onClick={() => onNext(slot.time)}
                  >
                    {formatTime(slot.time)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Cena */}
          {dinnerSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">CENA</h3>
              <div className="grid grid-cols-3 gap-2">
                {dinnerSlots.map((slot) => (
                  <Button
                    key={slot.id}
                    variant="outline"
                    className="h-12 hover:bg-black hover:text-white"
                    onClick={() => onNext(slot.time)}
                  >
                    {formatTime(slot.time)}
                  </Button>
                ))}
              </div>
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