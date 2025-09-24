import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";
import DateStep from "@/components/reservation/DateStep";
import GuestsStep from "@/components/reservation/GuestsStep";
import TimeStep from "@/components/reservation/TimeStep";
import InfoStep from "@/components/reservation/InfoStep";
import ConfirmationStep from "@/components/reservation/ConfirmationStep";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

interface CustomerData {
  fullName: string;
  phone: string;
  comments: string;
}

const ReservarPage = () => {
  const [currentStep, setCurrentStep] = useState<"date" | "guests" | "time" | "info" | "confirmation">("date");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const { toast } = useToast();
  const { config } = useRestaurantConfig();
  const [searchParams] = useSearchParams();

  // Verificar si debemos mostrar el formulario de cancelación
  useEffect(() => {
    const cancelParam = searchParams.get("cancel");
    if (cancelParam === "true") {
      setShowCancelForm(true);
    }
  }, [searchParams]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentStep("guests");
  };

  const handleGuestsSelect = (guests: number) => {
    setSelectedGuests(guests);
    setCurrentStep("time");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep("info");
  };

  const handleInfoComplete = (data: CustomerData) => {
    setCustomerData(data);
    createReservation(data);
  };

  const createReservation = async (customer: CustomerData) => {
    try {
      // Create customer with optional email using the new helper function
      const { data: customerId, error: customerError } = await supabase.rpc("create_customer_optional_email", {
        p_name: customer.fullName,
        p_phone: customer.phone,
        p_email: null, // No email provided
      });

      if (customerError) {
        console.error("Error creating customer:", customerError);

        // Mensajes de error específicos para creación de cliente
        let errorMessage = "Error desconocido al crear el cliente";

        if (customerError.code === "42883") {
          errorMessage = "La función de creación de cliente no existe en la base de datos. Contacta al administrador.";
        } else if (customerError.code === "23505") {
          errorMessage = "Ya existe un cliente con estos datos. Intenta con información diferente.";
        } else if (customerError.message.includes("permission denied")) {
          errorMessage = "No tienes permisos para crear clientes. Contacta al administrador.";
        } else if (customerError.message.includes("function") && customerError.message.includes("does not exist")) {
          errorMessage = "La función de base de datos no está disponible. Contacta al administrador.";
        } else {
          errorMessage = `Error de base de datos al crear cliente: ${customerError.message}`;
        }

        throw new Error(errorMessage);
      }

      if (!customerId) {
        throw new Error("La función de creación de cliente no devolvió un ID válido. Contacta al administrador.");
      }

      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      // Create reservation with table assignment using the updated RPC function
      const { data: result, error: reservationError } = await supabase.rpc("create_reservation_with_assignment", {
        p_customer_id: customerId,
        p_date: formatDateLocal(selectedDate!),
        p_time: selectedTime,
        p_guests: selectedGuests,
        p_special_requests: customer.comments || null,
        p_duration_minutes: 90,
      });

      if (reservationError) {
        console.error("Supabase reservation error:", reservationError);

        // Mensajes de error específicos para creación de reserva
        let errorMessage = "Error desconocido al crear la reserva";

        if (reservationError.code === "42883") {
          errorMessage = "La función de creación de reservas no existe en la base de datos. Contacta al administrador.";
        } else if (reservationError.message.includes("permission denied")) {
          errorMessage = "No tienes permisos para crear reservas. Contacta al administrador.";
        } else if (
          reservationError.message.includes("function") &&
          reservationError.message.includes("does not exist")
        ) {
          errorMessage = "La función de reservas no está disponible. Contacta al administrador.";
        } else {
          errorMessage = `Error de base de datos al crear reserva: ${reservationError.message}`;
        }

        throw new Error(errorMessage);
      }

      // Check if reservation was successful
      if (!result || typeof result !== "object" || !("success" in result) || !result.success) {
        console.error("Reservation creation failed:", result);

        const errorMessage =
          result && typeof result === "object" && "error" in result
            ? `Error en la lógica de reserva: ${result.error as string}`
            : "La reserva no se pudo procesar correctamente. Verifica disponibilidad e inténtalo de nuevo.";

        throw new Error(errorMessage);
      }

      const resultObj = result as any;
      setConfirmedReservation({
        id: resultObj.reservation_id,
        customer: {
          name: customer.fullName,
          phone: customer.phone,
        },
        date: formatDateLocal(selectedDate!),
        time: selectedTime,
        guests: selectedGuests,
        status: "confirmed",
      });
      setCurrentStep("confirmation");
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast({
        title: "Error al crear la reserva",
        description: error instanceof Error ? error.message : "Error desconocido. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      // Stay on info step on error
      setCurrentStep("info");
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "guests":
        setCurrentStep("date");
        break;
      case "time":
        setCurrentStep("guests");
        break;
      case "info":
        setCurrentStep("time");
        break;
      default:
        setCurrentStep("date");
    }
  };

  const handleStepClick = (step: "date" | "guests" | "time") => {
    if (step === "date") {
      setCurrentStep("date");
    } else if (step === "guests" && selectedDate) {
      setCurrentStep("guests");
    } else if (step === "time" && selectedDate && selectedGuests > 0) {
      setCurrentStep("time");
    }
  };

  const handleBackToStart = () => {
    setCurrentStep("date");
    setSelectedDate(null);
    setSelectedGuests(0);
    setSelectedTime("");
    setCustomerData(null);
    setConfirmedReservation(null);
    setShowCancelForm(false);
  };

  const handleCloseCancelForm = () => {
    setShowCancelForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="py-6 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al inicio</span>
          </Link>
          <h1 className="text-2xl font-bold text-primary">{config?.restaurant_name || "Restaurante Élite"}</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-restaurant-brown mb-4">
              {showCancelForm ? "Cancelar Reserva" : "Reserva tu Mesa"}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {showCancelForm
                ? "Ingresa tu número de teléfono para buscar y cancelar tu reserva"
                : "Completa el formulario y asegura tu lugar en una experiencia culinaria inolvidable"}
            </p>
          </div>

          {showCancelForm ? (
            <div className="max-w-lg mx-auto">
              <DateStep onNext={handleDateSelect} onBack={() => window.history.back()} initialShowCancelForm={true} />
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={handleCloseCancelForm} className="mx-auto">
                  Quiero hacer una reserva
                </Button>
              </div>
            </div>
          ) : (
            <>
              {currentStep === "date" && <DateStep onNext={handleDateSelect} onBack={() => window.history.back()} />}

              {currentStep === "guests" && (
                <GuestsStep
                  onNext={handleGuestsSelect}
                  onBack={handleBack}
                  onStepClick={handleStepClick}
                  selectedDate={selectedDate || undefined}
                />
              )}

              {currentStep === "time" && (
                <TimeStep
                  date={selectedDate!}
                  guests={selectedGuests}
                  onNext={handleTimeSelect}
                  onBack={handleBack}
                  onStepClick={handleStepClick}
                />
              )}

              {currentStep === "info" && (
                <InfoStep
                  onNext={handleInfoComplete}
                  onBack={handleBack}
                  selectedDate={selectedDate}
                  selectedGuests={selectedGuests}
                  selectedTime={selectedTime}
                  onStepClick={handleStepClick}
                />
              )}

              {currentStep === "confirmation" && confirmedReservation && (
                <ConfirmationStep reservation={confirmedReservation} onBack={handleBackToStart} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReservarPage;
