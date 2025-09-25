import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { formatDateLocal } from "@/lib/dateUtils";

import StepHeader from "./StepHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, AlertTriangle } from "lucide-react";

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  capacity: number;
  is_normalized?: boolean;
}

interface TimeStepProps {
  date: Date;
  guests: number;
  onNext: (time: string) => void;
  onBack: () => void;
  selectedDate?: Date;
  selectedGuests?: number;
  onStepClick?: (step: string) => void;
}

interface SuggestedSlot {
  time: string;
  capacity: number;
}

interface NormalizationError {
  success: false;
  error: string;
  original_time: string;
  normalized_time: string;
  suggested_times: SuggestedSlot[];
}

const formatTimeDisplay = (time: string): string => {
  // Si ya viene en formato HH:MM, devolverlo tal como está
  if (time.includes(":") && time.length === 5) {
    return time;
  }

  // Si viene en otro formato, convertirlo
  const [hours, minutes] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes?.padStart(2, "0") || "00"}`;
};

const TimeStep = ({ date, guests, onNext, onBack, selectedDate, selectedGuests, onStepClick }: TimeStepProps) => {
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [normalizationInfo, setNormalizationInfo] = useState<NormalizationError | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAvailability();
  }, [date, guests]);

  const checkAvailability = async () => {
    setLoading(true);
    setNormalizationInfo(null);

    try {
      if (!date || !guests) {
        setAvailableSlots([]);
        return;
      }

      const dateStr = formatDateLocal(date);

      // Use the normalized function to get only 15-minute slots
      const { data: rpcData, error } = await supabase.rpc("get_available_time_slots_15min", {
        p_date: dateStr,
        p_guests: guests,
        p_duration_minutes: 90,
      } as any);

      if (error) {
        console.error("RPC Error:", error);
        throw error;
      }

      // Transform the data to match the expected format
      const slots = Array.isArray(rpcData)
        ? rpcData.map((slot: any) => ({
            id: slot.id,
            time: slot.slot_time,
            available: true,
            capacity: slot.capacity,
            is_normalized: true,
          }))
        : [];

      setAvailableSlots(slots);
    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Error",
        description: "No se pudo verificar la disponibilidad.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSelection = async (selectedTime: string) => {
    // Since we're showing normalized slots, proceed directly
    onNext(selectedTime);
  };

  // Filtrar slots con hora actual
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const isToday = date.toDateString() === now.toDateString();

  const lunchSlots = availableSlots.filter((slot) => {
    const hour = parseInt(slot.time.split(":")[0]);
    const isLunchTime = hour >= 12 && hour < 17;
    const isAfterCurrentTime = !isToday || slot.time >= currentTime;
    return isLunchTime && isAfterCurrentTime;
  });

  const dinnerSlots = availableSlots.filter((slot) => {
    const hour = parseInt(slot.time.split(":")[0]);
    const isDinnerTime = hour >= 19 && hour <= 23;
    const isAfterCurrentTime = !isToday || slot.time >= currentTime;
    return isDinnerTime && isAfterCurrentTime;
  });

  // Debug: Ver qué slots tenemos
  console.log("=== DEBUG SLOTS ===");
  console.log("Total slots disponibles:", availableSlots.length);
  console.log(
    "Slots disponibles:",
    availableSlots.map((s) => s.time)
  );
  console.log(
    "Lunch slots:",
    lunchSlots.map((s) => s.time)
  );
  console.log(
    "Dinner slots:",
    dinnerSlots.map((s) => s.time)
  );
  console.log("==================");
  console.log("=== DEBUG FECHA ===");
  console.log("Fecha seleccionada:", date);
  console.log("Día de la semana (JS):", date.getDay()); // 0=Domingo, 1=Lunes, ..., 4=Jueves
  console.log("Día de la semana (SQL):", date.getDay()); // PostgreSQL usa mismo formato
  console.log("==================");
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
          {lunchSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3 text-gray-700">Comida</h3>
              <div className="grid grid-cols-3 gap-2">
                {lunchSlots.map((slot) => (
                  <Button
                    key={slot.id}
                    variant="outline"
                    className="h-12 hover:bg-black hover:text-white"
                    onClick={() => handleTimeSelection(slot.time)}
                  >
                    <div className="text-center">
                      <div className="font-medium">{formatTimeDisplay(slot.time)}</div>{" "}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Cena */}
          {dinnerSlots.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3 text-gray-700">Cena</h3>
              <div className="grid grid-cols-3 gap-2">
                {dinnerSlots.map((slot) => (
                  <Button
                    key={slot.id}
                    variant="outline"
                    className="h-12 hover:bg-black hover:text-white"
                    onClick={() => handleTimeSelection(slot.time)}
                  >
                    <div className="text-center">
                      <div className="font-medium">{formatTimeDisplay(slot.time)}</div>{" "}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* No slots available */}
          {lunchSlots.length === 0 && dinnerSlots.length === 0 && (
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
