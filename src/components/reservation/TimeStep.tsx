import React, { useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";
import { Clock, AlertTriangle, MapPin } from "lucide-react";
import { useAvailability, TimeSlotWithZone } from "@/hooks/reservations";
import { formatTimeDisplay, isSlotInPast } from "@/lib/reservations";

interface TimeStepProps {
  date: Date;
  guests: number;
  onNext: (time: string) => void;
  onBack: () => void;
  selectedDate?: Date;
  selectedGuests?: number;
  onStepClick?: (step: string) => void;
}

const TimeStep = ({ date, guests, onNext, onBack, selectedDate, selectedGuests, onStepClick }: TimeStepProps) => {
  // Use centralized availability hook with manual check
  const { availableSlots, isLoading, checkAvailability } = useAvailability({
    date,
    guests,
    durationMinutes: 90,
    autoCheck: false, // Disable auto-check to prevent infinite loop
  });

  // Use ref to track if we've already checked for current date/guests
  const lastCheckRef = useRef<string>("");
  const isCheckingRef = useRef<boolean>(false);

  // Convert date to stable string
  const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

  // Manual check when date or guests change
  useEffect(() => {
    const checkKey = `${dateKey}-${guests}`;
    
    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      console.log("⏭️ Skipping check - already in progress");
      return;
    }
    
    // Only check if date/guests actually changed
    if (checkKey === lastCheckRef.current) {
      console.log("⏭️ Skipping check - same date/guests");
      return;
    }
    
    console.log("✅ Running check for:", checkKey);
    lastCheckRef.current = checkKey;
    isCheckingRef.current = true;
    
    checkAvailability().finally(() => {
      isCheckingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, guests]);

  const handleTimeSelection = (selectedTime: string) => {
    onNext(selectedTime);
  };

  // Group slots by time period and zone
  const groupedSlots = useMemo(() => {
    const lunch: Record<string, TimeSlotWithZone[]> = {};
    const dinner: Record<string, TimeSlotWithZone[]> = {};

    availableSlots.forEach((slot) => {
      const hour = parseInt(slot.time.split(":")[0]);
      const isLunchTime = hour >= 12 && hour < 17;
      const isDinnerTime = hour >= 19 && hour <= 23;
      const notInPast = !isSlotInPast(date, slot.time);

      if (!notInPast) return;

      const zoneName = slot.zone_name || "Sin zona";

      if (isLunchTime) {
        if (!lunch[zoneName]) lunch[zoneName] = [];
        lunch[zoneName].push(slot);
      } else if (isDinnerTime) {
        if (!dinner[zoneName]) dinner[zoneName] = [];
        dinner[zoneName].push(slot);
      }
    });

    // Sort zones by priority
    const sortZones = (zones: Record<string, TimeSlotWithZone[]>) => {
      return Object.entries(zones).sort(([, slotsA], [, slotsB]) => {
        const priorityA = slotsA[0]?.zone_priority ?? 999;
        const priorityB = slotsB[0]?.zone_priority ?? 999;
        return priorityA - priorityB;
      });
    };

    return {
      lunch: sortZones(lunch),
      dinner: sortZones(dinner),
    };
  }, [availableSlots, date]);

  if (isLoading) {
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
            <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
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
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-medium text-primary">Selecciona una hora</h2>
        </div>

        <div className="space-y-6">
          {/* Comida */}
          {groupedSlots.lunch.length > 0 && (
            <div>
              <h3 className="font-bold text-base mb-4 text-gray-800">Comida</h3>
              <div className="space-y-4">
                {groupedSlots.lunch.map(([zoneName, slots]) => (
                  <div key={zoneName}>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">{zoneName}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <Button
                          key={slot.id}
                          variant="outline"
                          className="h-12 hover:bg-black hover:text-white"
                          onClick={() => handleTimeSelection(slot.time)}
                        >
                          <div className="text-center">
                            <div className="font-medium">{formatTimeDisplay(slot.time)}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cena */}
          {groupedSlots.dinner.length > 0 && (
            <div>
              <h3 className="font-bold text-base mb-4 text-gray-800">Cena</h3>
              <div className="space-y-4">
                {groupedSlots.dinner.map(([zoneName, slots]) => (
                  <div key={zoneName}>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">{zoneName}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <Button
                          key={slot.id}
                          variant="outline"
                          className="h-12 hover:bg-black hover:text-white"
                          onClick={() => handleTimeSelection(slot.time)}
                        >
                          <div className="text-center">
                            <div className="font-medium">{formatTimeDisplay(slot.time)}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No slots available */}
          {groupedSlots.lunch.length === 0 && groupedSlots.dinner.length === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">No hay horarios disponibles para esta fecha</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TimeStep;
