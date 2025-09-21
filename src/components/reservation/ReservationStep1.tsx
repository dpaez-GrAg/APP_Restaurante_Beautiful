import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  capacity: number;
}

interface ReservationStep1Props {
  onNext: (data: { date: Date; time: string; guests: number }) => void;
  onBack: () => void;
}

const ReservationStep1 = ({ onNext, onBack }: ReservationStep1Props) => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedGuests, setSelectedGuests] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { config } = useRestaurantConfig();

  const checkAvailability = async (date: Date, guests: number) => {
    setLoading(true);
    try {
      // Get restaurant schedules for the selected day
      const dayOfWeek = date.getDay();
      const { data: schedules, error: schedulesError } = await supabase
        .from("restaurant_schedules")
        .select("*")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true);

      if (schedulesError) throw schedulesError;

      if (!schedules || schedules.length === 0) {
        setAvailableSlots([]);
        return;
      }

      // Get all time slots
      const { data: timeSlots, error: slotsError } = await supabase.from("time_slots").select("*").order("time");

      if (slotsError) throw slotsError;

      // Get existing reservations for the selected date
      const { data: reservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("time, guests")
        .eq("date", date.toISOString().split("T")[0]);

      if (reservationsError) throw reservationsError;

      // Filter time slots to only include those within opening hours
      const validSlots =
        timeSlots?.filter((slot) => {
          const slotTime = slot.time;
          return schedules.some((schedule) => slotTime >= schedule.opening_time && slotTime <= schedule.closing_time);
        }) || [];

      // Calculate availability
      const slots: TimeSlot[] = validSlots.map((slot) => {
        const reservedGuests =
          reservations?.filter((r) => r.time === slot.time)?.reduce((sum, r) => sum + r.guests, 0) || 0;

        const availableCapacity = slot.max_capacity - reservedGuests;

        return {
          id: slot.id,
          time: slot.time,
          available: availableCapacity >= guests,
          capacity: availableCapacity,
        };
      });

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

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime("");
    setAvailableSlots([]);

    if (date && selectedGuests) {
      checkAvailability(date, parseInt(selectedGuests));
    }
  };

  const handleGuestsChange = (guests: string) => {
    setSelectedGuests(guests);
    setSelectedTime("");
    setAvailableSlots([]);

    if (selectedDate && guests) {
      checkAvailability(selectedDate, parseInt(guests));
    }
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime && selectedGuests) {
      onNext({
        date: selectedDate,
        time: selectedTime,
        guests: parseInt(selectedGuests),
      });
    }
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  const lunchSlots = availableSlots.filter((slot) => {
    const hour = parseInt(slot.time.split(":")[0]);
    return hour >= 13 && hour < 16;
  });

  const dinnerSlots = availableSlots.filter((slot) => {
    const hour = parseInt(slot.time.split(":")[0]);
    return hour >= 19;
  });

  return (
    <Card className="max-w-4xl mx-auto shadow-elegant">
      <CardHeader className="text-center border-b">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ChevronLeft className="w-4 h-4" />
            <span className="sr-only">Volver</span>
          </Button>
          <CardTitle className="text-2xl text-restaurant-brown">
            {config?.restaurant_name ?? "RESTAURANTE ÉLITE"}
          </CardTitle>
          <div className="w-10"></div>
        </div>

        {/* Progress indicators */}
        <div className="flex justify-center gap-8 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <span className="text-sm font-medium">Encontrar</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300 mt-4"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
              2
            </div>
            <span className="text-sm text-gray-600">Información</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300 mt-4"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
              3
            </div>
            <span className="text-sm text-gray-600">Adicional</span>
          </div>
          <div className="w-16 h-0.5 bg-gray-300 mt-4"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
              4
            </div>
            <span className="text-sm text-gray-600">Confirmación</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Guest selection and Calendar */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Número de personas
              </label>
              <Select value={selectedGuests} onValueChange={handleGuestsChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona número de personas" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} personas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Mensaje para grupos grandes */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-amber-800 mb-2">
                  <strong>¿Grupo de más de 7 personas?</strong>
                </p>
                <p className="text-xs text-amber-700 mb-2">
                  Para reservas de grupos grandes, contáctanos directamente:
                </p>
                <a
                  href={`mailto:${
                    config?.contact_email ?? "info@restaurante-elite.com"
                  }?subject=Solicitud de reserva para grupo grande&body=Hola,%0D%0A%0D%0AMe gustaría hacer una reserva para un grupo de más de 7 personas.%0D%0A%0D%0ADetalles:%0D%0A- Número de personas: %0D%0A- Fecha preferida: %0D%0A- Hora preferida: %0D%0A- Ocasión especial (opcional): %0D%0A%0D%0AGracias.`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                >
                  📧 {config?.contact_email ?? "info@restaurante-elite.com"}
                </a>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selecciona una fecha</label>
              <div className={`border rounded-lg p-4 ${!selectedGuests ? "opacity-50 pointer-events-none" : ""}`}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateChange}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const compareDate = new Date(date);
                    compareDate.setHours(0, 0, 0, 0);
                    return compareDate < today || !selectedGuests;
                  }}
                  className="w-full"
                />
              </div>
              {!selectedGuests && (
                <p className="text-xs text-muted-foreground mt-1">Primero selecciona el número de personas</p>
              )}
            </div>

            {/* Restaurant info */}
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-medium text-sm mb-2">INFORMACIÓN RESTAURANTE</h3>
              <p className="text-xs text-muted-foreground">La información de que el local no dispone de tronas.</p>
            </div>
          </div>

          {/* Right side - Available time slots */}
          <div className="space-y-6">
            {loading && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Verificando disponibilidad...</p>
              </div>
            )}

            {!loading && availableSlots.length > 0 && (
              <>
                {/* Lunch slots */}
                {lunchSlots.length > 0 && (
                  <div>
                    <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      COMIDA
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {lunchSlots.map((slot) => (
                        <Button
                          key={slot.id}
                          variant={selectedTime === slot.time ? "default" : "outline"}
                          className={`h-12 ${
                            !slot.available
                              ? "opacity-50 cursor-not-allowed"
                              : selectedTime === slot.time
                              ? "bg-primary text-white"
                              : "hover:bg-primary/10"
                          }`}
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                        >
                          {formatTime(slot.time)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Waiting list notice */}

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-orange-700">
                    Para grupos de más de 8, envíanos un mail a{" "}
                    <a href={`mailto:${config?.contact_email ?? "info@restaurante-elite.com"}`} className="underline">
                      {config?.contact_email ?? "info@restaurante-elite.com"}
                    </a>
                  </p>
                </div>

                {/* Dinner slots */}
                {dinnerSlots.length > 0 && (
                  <div>
                    <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      CENA
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {dinnerSlots.map((slot) => (
                        <Button
                          key={slot.id}
                          variant={selectedTime === slot.time ? "default" : "outline"}
                          className={`h-12 ${
                            !slot.available
                              ? "opacity-50 cursor-not-allowed"
                              : selectedTime === slot.time
                              ? "bg-primary text-white"
                              : "hover:bg-primary/10"
                          }`}
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                        >
                          {formatTime(slot.time)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!loading && selectedDate && selectedGuests && availableSlots.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay horarios disponibles para la fecha seleccionada.</p>
              </div>
            )}
          </div>
        </div>

        {/* Continue button */}
        {selectedDate && selectedTime && selectedGuests && (
          <div className="flex justify-center mt-8">
            <Button onClick={handleContinue} className="px-8 py-2" size="lg">
              Continuar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReservationStep1;
