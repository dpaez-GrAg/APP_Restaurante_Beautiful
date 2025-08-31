import { useState } from "react";
import ReservationStep1 from "./reservation/ReservationStep1";
import ReservationStep2 from "./reservation/ReservationStep2";

interface ReservationData {
  date: Date;
  time: string;
  guests: number;
}

const ReservationForm = () => {
  const [currentStep, setCurrentStep] = useState<'initial' | 'step1' | 'step2'>('initial');
  const [reservationData, setReservationData] = useState<ReservationData | null>(null);

  const handleStartReservation = () => {
    setCurrentStep('step1');
  };

  const handleStep1Complete = (data: ReservationData) => {
    setReservationData(data);
    setCurrentStep('step2');
  };

  const handleStep2Back = () => {
    setCurrentStep('step1');
  };

  const handleComplete = () => {
    setCurrentStep('initial');
    setReservationData(null);
  };

  const handleBackToInitial = () => {
    setCurrentStep('initial');
    setReservationData(null);
  };

  if (currentStep === 'step1') {
    return (
      <section id="reservation" className="py-20 bg-gradient-subtle">
        <div className="container mx-auto px-4">
          <ReservationStep1 
            onNext={handleStep1Complete}
            onBack={handleBackToInitial}
          />
        </div>
      </section>
    );
  }

  if (currentStep === 'step2' && reservationData) {
    return (
      <section id="reservation" className="py-20 bg-gradient-subtle">
        <div className="container mx-auto px-4">
          <ReservationStep2 
            reservationData={reservationData}
            onBack={handleStep2Back}
            onComplete={handleComplete}
          />
        </div>
      </section>
    );
  }

  return (
    <section id="reservation" className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-restaurant-brown mb-4">
            Reserva tu Mesa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Completa el formulario y asegura tu lugar en una experiencia culinaria inolvidable
          </p>
        </div>

        <div className="max-w-2xl mx-auto text-center animate-slide-up">
          <button 
            onClick={handleStartReservation}
            className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors shadow-elegant"
          >
            Comenzar Reserva
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReservationForm;