import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";
import DateStep from "@/components/reservation/DateStep";
import GuestsStep from "@/components/reservation/GuestsStep";
import TimeStep from "@/components/reservation/TimeStep";
import InfoStep from "@/components/reservation/InfoStep";
import ConfirmationStep from "@/components/reservation/ConfirmationStep";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useReservationCreation } from "@/hooks/reservations";
import { formatDateLocal } from "@/lib/dateUtils";

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
  const { config } = useRestaurantConfig();
  const [searchParams] = useSearchParams();
  
  // Use centralized reservation creation hook
  const { createReservation, isLoading: isCreatingReservation } = useReservationCreation();

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

  const handleInfoComplete = async (data: CustomerData) => {
    setCustomerData(data);
    
    // Use centralized reservation creation
    const result = await createReservation({
      customerName: data.fullName,
      customerPhone: data.phone,
      date: formatDateLocal(selectedDate!),
      time: selectedTime,
      guests: selectedGuests,
      special_requests: data.comments || undefined,
      duration_minutes: 90,
    });

    if (result.success) {
      setConfirmedReservation({
        id: result.reservation_id,
        customer: {
          name: data.fullName,
          phone: data.phone,
        },
        date: formatDateLocal(selectedDate!),
        time: selectedTime,
        guests: selectedGuests,
        status: "confirmed",
      });
      setCurrentStep("confirmation");
    } else {
      // Error handling is done by the hook, just stay on info step
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
