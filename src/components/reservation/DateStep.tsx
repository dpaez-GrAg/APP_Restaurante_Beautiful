import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import StepHeader from "./StepHeader";

interface DateStepProps {
  onNext: (date: Date) => void;
  onBack: () => void;
  initialShowCancelForm?: boolean;
}

const DateStep = ({ onNext, onBack, initialShowCancelForm = false }: DateStepProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(initialShowCancelForm);
  const [cancelPhone, setCancelPhone] = useState("");
  const [foundReservations, setFoundReservations] = useState<any[]>([]);
  const { toast } = useToast();

  // Si initialShowCancelForm cambia, actualizar showCancelForm
  useEffect(() => {
    setShowCancelForm(initialShowCancelForm);
  }, [initialShowCancelForm]);

  const daysOfWeek = ["L", "M", "X", "J", "V", "S", "D"];
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const handleDateClick = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    // Calcular fecha máxima (2 semanas = 14 días desde hoy)
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);

    if (date >= today && date <= maxDate) {
      setSelectedDate(date);
      onNext(date);
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular fecha máxima (2 semanas desde hoy)
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);

    if (direction === "prev") {
      const prevMonth = new Date(currentDate);
      prevMonth.setMonth(currentDate.getMonth() - 1);

      // No permitir navegar a meses anteriores al actual
      if (prevMonth.getMonth() >= today.getMonth() && prevMonth.getFullYear() >= today.getFullYear()) {
        setCurrentDate(prevMonth);
      }
    } else {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(currentDate.getMonth() + 1);

      // Solo permitir navegar si el próximo mes contiene fechas dentro del límite de 2 semanas
      const firstDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
      if (firstDayOfNextMonth <= maxDate) {
        setCurrentDate(nextMonth);
      }
    }
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    // Calcular fecha máxima (2 semanas = 14 días desde hoy)
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);

    // Deshabilitar fechas anteriores a hoy o posteriores a 2 semanas
    return date < today || date > maxDate;
  };

  const handleCancelSearch = async () => {
    if (!cancelPhone) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu número de teléfono",
        variant: "destructive",
      });
      return;
    }

    try {
      // Normalizar el número de teléfono (eliminar espacios y otros caracteres no numéricos)
      const normalizedPhone = cancelPhone.replace(/\s+/g, "").replace(/[^\d]/g, "");
      // console.log("Buscando reservas para el número normalizado:", normalizedPhone);

      // Método 1: Buscar cliente por teléfono
      const { data: customers, error: customerError } = await supabase
        .from("customers")
        .select("id, name, phone")
        .or(`phone.eq.${normalizedPhone},phone.ilike.%${normalizedPhone}%,phone.ilike.%${normalizedPhone.slice(-9)}%`);

      if (customerError) {
        console.error("Error al buscar clientes:", customerError);
        throw customerError;
      }

      // console.log("Clientes encontrados:", customers);

      // Recopilar todos los IDs de clientes que coincidan
      const customerIds = customers?.map((c) => c.id) || [];

      // Método 2: Buscar directamente todas las reservas futuras
      const today = new Date().toISOString().split("T")[0];

      // Consulta para obtener todas las reservas futuras
      const { data: allFutureReservations, error: allReservationsError } = await supabase
        .from("reservations")
        .select("*, customers(id, name, phone, email)")
        .gte("date", today)
        .in("status", ["pending", "confirmed"]);

      if (allReservationsError) {
        console.error("Error al buscar todas las reservas:", allReservationsError);
        throw allReservationsError;
      }

      // console.log("Todas las reservas futuras:", allFutureReservations);

      // Filtrar reservas que coincidan con el número de teléfono (ya sea por ID de cliente o por teléfono en la tabla de clientes)
      const matchingReservations = allFutureReservations?.filter((reservation) => {
        // Si tenemos IDs de clientes que coinciden, verificar si esta reserva pertenece a alguno de ellos
        if (customerIds.length > 0 && customerIds.includes(reservation.customer_id)) {
          return true;
        }

        // También verificar si el teléfono del cliente asociado a la reserva coincide
        const customerPhone = reservation.customers?.phone || "";
        const normalizedCustomerPhone = customerPhone.replace(/\s+/g, "").replace(/[^\d]/g, "");

        return (
          normalizedCustomerPhone.includes(normalizedPhone) ||
          normalizedPhone.includes(normalizedCustomerPhone) ||
          normalizedCustomerPhone.includes(normalizedPhone.slice(-9)) ||
          normalizedPhone.slice(-9).includes(normalizedCustomerPhone)
        );
      });

      // console.log("Reservas coincidentes:", matchingReservations);

      if (!matchingReservations || matchingReservations.length === 0) {
        toast({
          title: "No encontrado",
          description: "No se encontraron reservas futuras para este número de teléfono",
          variant: "destructive",
        });
        return;
      }

      // Usar las reservas encontradas
      setFoundReservations(matchingReservations);
    } catch (error) {
      console.error("Error searching reservations:", error);
      toast({
        title: "Error",
        description: "Error al buscar reservas. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    try {
      const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", reservationId);

      if (error) throw error;

      toast({
        title: "Reserva cancelada",
        description: "Tu reserva ha sido cancelada exitosamente",
      });

      // Remove the cancelled reservation from the list
      setFoundReservations((prev) => prev.filter((r) => r.id !== reservationId));
    } catch (error) {
      console.error("Error canceling reservation:", error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la reserva. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  const days = getDaysInMonth(currentDate);

  if (showCancelForm) {
    return (
      <div className="max-w-lg mx-auto">
        <StepHeader currentStep="date" />

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium text-primary mb-6">Cancelar Reserva</h2>

          {foundReservations.length === 0 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ingresa tu número de teléfono para buscar tus reservas:
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md">
                    +34
                  </span>
                  <Input
                    type="tel"
                    value={cancelPhone}
                    onChange={(e) => setCancelPhone(e.target.value)}
                    placeholder="Ej. 612345678"
                    className="rounded-l-none w-full"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <Button
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelPhone("");
                  }}
                  variant="ghost"
                  className="flex-1"
                >
                  Volver
                </Button>

                <Button onClick={handleCancelSearch} className="flex-1 bg-primary hover:bg-primary/90 text-white">
                  Buscar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium">Reservas encontradas:</h3>

              {foundReservations.map((reservation) => (
                <div key={reservation.id} className="border rounded-lg p-4 space-y-2">
                  <div className="text-sm">
                    <p>
                      <strong>Fecha:</strong> {formatDate(reservation.date)}
                    </p>
                    <p>
                      <strong>Hora:</strong> {formatTime(reservation.time)}
                    </p>
                    <p>
                      <strong>Personas:</strong> {reservation.guests}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleCancelReservation(reservation.id)}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    Cancelar esta reserva
                  </Button>
                </div>
              ))}

              <Button
                onClick={() => {
                  setShowCancelForm(false);
                  setCancelPhone("");
                  setFoundReservations([]);
                }}
                variant="ghost"
                className="w-full mt-4"
              >
                Volver
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <StepHeader currentStep="date" />

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-primary mb-6">Selecciona una fecha</h2>

        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth("prev")} className="p-2">
            <ChevronLeft size={16} />
          </Button>

          <h3 className="font-medium">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>

          <Button variant="ghost" size="sm" onClick={() => navigateMonth("next")} className="p-2">
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, index) => (
            <div key={index} className="aspect-square">
              {date && (
                <Button
                  variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "ghost"}
                  className={`w-full h-full text-sm ${
                    isDateDisabled(date)
                      ? "opacity-30 cursor-not-allowed text-gray-400"
                      : selectedDate?.toDateString() === date.toDateString()
                      ? "bg-black text-white"
                      : "hover:bg-gray-100"
                  }`}
                  disabled={isDateDisabled(date)}
                  onClick={() => handleDateClick(date)}
                >
                  {date.getDate()}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-xs text-gray-500 text-center mb-4">
            Solo puedes reservar con hasta 2 semanas de antelación
          </p>
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                setShowCancelForm(true);
              }}
              className="text-primary"
            >
              Cancelar reserva
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateStep;
