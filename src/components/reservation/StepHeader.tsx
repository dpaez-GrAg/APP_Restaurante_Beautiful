import { Calendar, Users, Clock, User, Check } from "lucide-react";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";

interface StepHeaderProps {
  currentStep: 'date' | 'guests' | 'time' | 'info' | 'confirmation';
  selectedDate?: Date;
  selectedGuests?: number;
  selectedTime?: string;
  onStepClick?: (step: 'date' | 'guests' | 'time') => void;
}

const StepHeader = ({ currentStep, selectedDate, selectedGuests, selectedTime, onStepClick }: StepHeaderProps) => {
  const { config } = useRestaurantConfig();

  const getStepLabel = (step: string) => {
    switch (step) {
      case 'date': return 'Fecha';
      case 'guests': return 'Personas';
      case 'time': return 'Hora';
      case 'info': return 'Información';
      case 'confirmation': return 'Confirmación';
      default: return '';
    }
  };

  const isCompleted = (step: string) => {
    switch (step) {
      case 'date': return !!selectedDate;
      case 'guests': return selectedGuests && selectedGuests > 0;
      case 'time': return !!selectedTime;
      case 'info': return currentStep === 'confirmation';
      default: return false;
    }
  };

  const canGoBackTo = (step: string) => {
    switch (step) {
      case 'date': return currentStep !== 'date' && (currentStep === 'guests' || currentStep === 'time' || currentStep === 'info' || currentStep === 'confirmation');
      case 'guests': return isCompleted('date') && currentStep !== 'guests' && (currentStep === 'time' || currentStep === 'info' || currentStep === 'confirmation');
      case 'time': return isCompleted('guests') && currentStep !== 'time' && (currentStep === 'info' || currentStep === 'confirmation');
      default: return false;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      {/* Restaurant Logo/Name */}
      <div className="flex items-center justify-center py-6 border-b">
        <div className="flex items-center justify-center">
          <span className="text-primary font-bold text-lg">
            RESERVAS {config?.restaurant_name?.toUpperCase() || 'RESTAURANTE ÉLITE'}
          </span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center space-x-4">
          {/* Date Step */}
          <div 
            className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${
              currentStep === 'date' || isCompleted('date') 
                ? 'bg-primary text-white' 
                : 'bg-gray-100 text-gray-500'
            } ${canGoBackTo('date') ? 'cursor-pointer hover:bg-primary/80' : ''}`}
            onClick={() => canGoBackTo('date') && onStepClick?.('date')}
          >
            <Calendar size={16} />
            <span>
              {isCompleted('date') ? formatDate(selectedDate!) : getStepLabel('date')}
            </span>
          </div>

          {/* Guests Step */}
          <div 
            className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${
              currentStep === 'guests' || isCompleted('guests')
                ? 'bg-primary text-white' 
                : 'bg-gray-100 text-gray-500'
            } ${canGoBackTo('guests') ? 'cursor-pointer hover:bg-primary/80' : ''}`}
            onClick={() => canGoBackTo('guests') && onStepClick?.('guests')}
          >
            <Users size={16} />
            <span>
              {isCompleted('guests') ? selectedGuests : getStepLabel('guests')}
            </span>
          </div>

          {/* Time Step */}
          <div 
            className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${
              currentStep === 'time' || isCompleted('time')
                ? 'bg-primary text-white' 
                : 'bg-gray-100 text-gray-500'
            } ${canGoBackTo('time') ? 'cursor-pointer hover:bg-primary/80' : ''}`}
            onClick={() => canGoBackTo('time') && onStepClick?.('time')}
          >
            <Clock size={16} />
            <span>
              {isCompleted('time') ? formatTime(selectedTime!) : getStepLabel('time')}
            </span>
          </div>

          {/* Info Step */}
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${
            currentStep === 'info' || currentStep === 'confirmation'
              ? 'bg-primary text-white' 
              : 'bg-gray-100 text-gray-500'
          }`}>
            {currentStep === 'confirmation' ? <Check size={16} /> : <User size={16} />}
            <span>{currentStep === 'confirmation' ? 'Confirmado' : getStepLabel('info')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepHeader;