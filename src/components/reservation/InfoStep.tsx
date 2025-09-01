import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import StepHeader from "./StepHeader";

interface InfoStepProps {
  onNext: (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    comments: string;
  }) => void;
  onBack: () => void;
  selectedDate?: Date;
  selectedGuests?: number;
  selectedTime?: string;
  onStepClick?: (step: 'date' | 'guests' | 'time') => void;
}

const InfoStep = ({ onNext, onBack, selectedDate, selectedGuests, selectedTime, onStepClick }: InfoStepProps) => {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    comments: '',
    privacyAccepted: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.phone || !formData.privacyAccepted) {
      return;
    }

    onNext({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      comments: formData.comments
    });
  };

  const isFormValid = formData.email && formData.firstName && formData.lastName && formData.phone && formData.privacyAccepted;

  return (
    <div className="max-w-lg mx-auto">
      <StepHeader 
        currentStep="info" 
        selectedDate={selectedDate}
        selectedGuests={selectedGuests}
        selectedTime={selectedTime}
        onStepClick={onStepClick}
      />
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-primary mb-6">Datos de contacto</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Correo electrónico</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Nombre</label>
            <Input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Apellidos</label>
            <Input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Teléfono</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md">
                +34
              </span>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="rounded-l-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Observaciones (¿Necesidades especiales? ¿Vienes con carrito? Cuéntanos toda la información que sea útil para hacer tu experiencia lo mejor posible.)
            </label>
            <Textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="w-full h-24"
              placeholder=""
            />
          </div>

          <div className="flex items-start space-x-2 pt-4">
            <Checkbox
              id="privacy"
              checked={formData.privacyAccepted}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, privacyAccepted: checked as boolean })
              }
            />
            <label htmlFor="privacy" className="text-sm leading-relaxed">
              Acepto la{' '}
              <Link to="/politica-privacidad" className="text-primary underline">
                política de privacidad
              </Link>
            </label>
          </div>

          <div className="flex justify-between pt-6">
            <Button type="button" variant="ghost" onClick={onBack} className="text-primary">
              ← Volver
            </Button>
            
            <Button
              type="submit"
              disabled={!isFormValid}
              className={`px-8 ${
                isFormValid 
                  ? 'bg-primary hover:bg-primary/90 text-white' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              OK
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InfoStep;