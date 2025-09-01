import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StepHeader from "./StepHeader";

interface DateStepProps {
  onNext: (date: Date) => void;
  onBack: () => void;
}

const DateStep = ({ onNext, onBack }: DateStepProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelEmail, setCancelEmail] = useState('');
  const [foundReservations, setFoundReservations] = useState<any[]>([]);
  const { toast } = useToast();

  const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
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
    
    if (date >= today) {
      setSelectedDate(date);
      onNext(date);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleCancelSearch = async () => {
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
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customer) {
        toast({
          title: "No encontrado",
          description: "No se encontraron reservas con ese correo electrónico",
          variant: "destructive",
        });
        return;
      }

      // Find future reservations for this customer
      const today = new Date().toISOString().split('T')[0];
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('status', 'pending')
        .gte('date', today);

      if (reservationsError) throw reservationsError;

      if (!reservations || reservations.length === 0) {
        toast({
          title: "No encontrado",
          description: "No se encontraron reservas futuras para este correo",
          variant: "destructive",
        });
        return;
      }

      setFoundReservations(reservations);
    } catch (error) {
      console.error('Error searching reservations:', error);
      toast({
        title: "Error",
        description: "Error al buscar reservas. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: "Reserva cancelada",
        description: "Tu reserva ha sido cancelada exitosamente",
      });

      // Remove the cancelled reservation from the list
      setFoundReservations(prev => prev.filter(r => r.id !== reservationId));
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
                  Ingresa tu correo electrónico para buscar tus reservas:
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
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelEmail('');
                  }}
                  variant="ghost"
                  className="flex-1"
                >
                  Volver
                </Button>
                
                <Button
                  onClick={handleCancelSearch}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white"
                >
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
                    <p><strong>Fecha:</strong> {formatDate(reservation.date)}</p>
                    <p><strong>Hora:</strong> {formatTime(reservation.time)}</p>
                    <p><strong>Personas:</strong> {reservation.guests}</p>
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
                  setCancelEmail('');
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('prev')}
            className="p-2"
          >
            <ChevronLeft size={16} />
          </Button>
          
          <h3 className="font-medium">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMonth('next')}
            className="p-2"
          >
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
                      ? 'opacity-30 cursor-not-allowed' 
                      : selectedDate?.toDateString() === date.toDateString()
                      ? 'bg-black text-white'
                      : 'hover:bg-gray-100'
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

        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            onClick={() => setShowCancelForm(true)} 
            className="text-primary"
          >
            Cancelar reserva
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DateStep;