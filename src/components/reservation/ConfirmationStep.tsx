import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StepHeader from "./StepHeader";

interface ConfirmationStepProps {
  reservation: {
    id: string;
    date: string;
    time: string;
    guests: number;
    customer: {
      email: string;
      name: string;
    };
  };
  onBack: () => void;
}

const ConfirmationStep = ({ reservation, onBack }: ConfirmationStepProps) => {
  const [cancelEmail, setCancelEmail] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const { toast } = useToast();

  const handleCancelReservation = async () => {
    if (!cancelEmail) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu correo electrónico",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find customer by email
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', cancelEmail)
        .single();

      if (customerError || !customer) {
        toast({
          title: "Error",
          description: "No se encontró ninguna reserva con ese correo electrónico",
          variant: "destructive",
        });
        return;
      }

      // Find and cancel the reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('customer_id', customer.id)
        .eq('status', 'pending');

      if (updateError) throw updateError;

      toast({
        title: "Reserva cancelada",
        description: "Tu reserva ha sido cancelada exitosamente",
      });

      setCancelEmail('');
      setShowCancelForm(false);
      onBack();
    } catch (error) {
      console.error('Error canceling reservation:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la reserva. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  return (
    <div className="max-w-lg mx-auto">
      <StepHeader currentStep="confirmation" />
      
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        {!showCancelForm ? (
          <>
            <div className="mb-8">
              <p className="text-lg mb-4">
                <strong>{reservation.customer.name}</strong>, tu reserva para el día <strong>{formatDate(reservation.date)}</strong> para <strong>{reservation.guests} {reservation.guests === 1 ? 'persona' : 'personas'}</strong> está confirmada.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-gray-600 text-sm mb-2">Detalles de la reserva:</p>
              <p className="font-medium">{reservation.customer.email}</p>
              <p className="text-sm text-gray-600 mt-2">
                {formatDate(reservation.date)} a las {formatTime(reservation.time)} para {reservation.guests} {reservation.guests === 1 ? 'persona' : 'personas'}
              </p>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={() => setShowCancelForm(true)}
                className="text-sm text-gray-600 underline hover:text-gray-800"
              >
                Cancelar reserva
              </button>
              
              <button
                onClick={onBack}
                className="block text-sm text-primary underline hover:text-primary/80"
              >
                Hacer nueva reserva
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium mb-6">Cancelar Reserva</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ingresa tu correo electrónico para cancelar la reserva:
                </label>
                <Input
                  type="email"
                  value={cancelEmail}
                  onChange={(e) => setCancelEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full"
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  onClick={() => setShowCancelForm(false)}
                  variant="ghost"
                  className="flex-1"
                >
                  Volver
                </Button>
                
                <Button
                  onClick={handleCancelReservation}
                  variant="destructive"
                  className="flex-1"
                >
                  Cancelar Reserva
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfirmationStep;