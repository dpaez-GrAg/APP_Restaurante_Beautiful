import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DateStep from "./reservation/DateStep";
import GuestsStep from "./reservation/GuestsStep";
import TimeStep from "./reservation/TimeStep";
import InfoStep from "./reservation/InfoStep";
import ConfirmationStep from "./reservation/ConfirmationStep";
import { format } from "date-fns";

interface ReservationData {
  date: Date;
  time: string;
  guests: number;
}

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  comments: string;
}

const ReservationForm = () => {
  const [currentStep, setCurrentStep] = useState<'initial' | 'date' | 'guests' | 'time' | 'info' | 'confirmation'>('initial');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);
  const { toast } = useToast();

  const handleStartReservation = () => {
    setCurrentStep('date');
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentStep('guests');
  };

  const handleGuestsSelect = (guests: number) => {
    setSelectedGuests(guests);
    setCurrentStep('time');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep('info');
  };

  const handleInfoComplete = (data: CustomerData) => {
    setCustomerData(data);
    // Here we'd make the reservation
    createReservation(data);
  };

  const createReservation = async (customer: CustomerData) => {
    try {
      // Create or find customer
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('email', customer.email)
        .single();

      let customerId;
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phone
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Helper function to format date as YYYY-MM-DD in local timezone
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Create reservation with table assignment using the new RPC function
      const { data: result, error: reservationError } = await supabase
        .rpc('create_reservation_with_assignment', {
          p_customer_id: customerId,
          p_date: formatDateLocal(selectedDate!),
          p_time: selectedTime,
          p_guests: selectedGuests,
          p_special_requests: customer.comments || null,
          p_duration_minutes: 90
        });

      if (reservationError) throw reservationError;

      // Check if reservation was successful
      if (!result || typeof result !== 'object' || !('success' in result) || !result.success) {
        console.error('Reservation creation failed:', result);
        const errorMessage = result && typeof result === 'object' && 'error' in result 
          ? result.error as string 
          : 'No se pudo crear la reserva. Por favor, inténtalo de nuevo.';
        
        throw new Error(errorMessage);
      }

      const resultObj = result as any;
      setConfirmedReservation({
        id: resultObj.reservation_id,
        customer: { 
          email: customer.email,
          name: customer.firstName
        },
        date: formatDateLocal(selectedDate!),
        time: selectedTime,
        guests: selectedGuests,
        status: 'confirmed'
      });
      setCurrentStep('confirmation');
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear la reserva. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      
      // Return to time step to refresh availability
      setCurrentStep('time');
    }
  };

  const handleBackToInitial = () => {
    setCurrentStep('initial');
    setSelectedDate(null);
    setSelectedGuests(0);
    setSelectedTime('');
    setCustomerData(null);
    setConfirmedReservation(null);
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'guests':
        setCurrentStep('date');
        break;
      case 'time':
        setCurrentStep('guests');
        break;
      case 'info':
        setCurrentStep('time');
        break;
      default:
        setCurrentStep('initial');
    }
  };

  const handleStepClick = (step: 'date' | 'guests' | 'time') => {
    if (step === 'date') {
      setCurrentStep('date');
    } else if (step === 'guests' && selectedDate) {
      setCurrentStep('guests');
    } else if (step === 'time' && selectedDate && selectedGuests > 0) {
      setCurrentStep('time');
    }
  };

  return (
    <section id="reservation" className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-4">
        {currentStep === 'initial' && (
          <>
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl font-bold text-restaurant-brown mb-4">
                Reserva tu Mesa
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Completa el formulario y asegura tu lugar en una experiencia culinaria inolvidable
              </p>
            </div>

            <div className="max-w-2xl mx-auto text-center animate-slide-up">
              <Button 
                onClick={handleStartReservation}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors shadow-elegant"
                size="lg"
              >
                Comenzar Reserva
              </Button>
            </div>
          </>
        )}

        {currentStep === 'date' && (
          <DateStep onNext={handleDateSelect} onBack={handleBackToInitial} />
        )}

        {currentStep === 'guests' && (
          <GuestsStep 
            onNext={handleGuestsSelect} 
            onBack={handleBack}
            onStepClick={handleStepClick}
            selectedDate={selectedDate || undefined}
          />
        )}

        {currentStep === 'time' && (
          <TimeStep 
            date={selectedDate!} 
            guests={selectedGuests} 
            onNext={handleTimeSelect} 
            onBack={handleBack}
            onStepClick={handleStepClick}
          />
        )}

        {currentStep === 'info' && (
          <InfoStep 
            onNext={handleInfoComplete} 
            onBack={handleBack}
            selectedDate={selectedDate}
            selectedGuests={selectedGuests}
            selectedTime={selectedTime}
            onStepClick={handleStepClick}
          />
        )}

        {currentStep === 'confirmation' && confirmedReservation && (
          <ConfirmationStep 
            reservation={confirmedReservation}
            onBack={handleBackToInitial}
          />
        )}
      </div>
    </section>
  );
};

export default ReservationForm;