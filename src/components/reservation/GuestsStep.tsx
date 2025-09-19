import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";

interface GuestsStepProps {
  onNext: (guests: number) => void;
  onBack: () => void;
  onStepClick?: (step: "date" | "guests" | "time") => void;
  selectedDate?: Date;
}

const GuestsStep = ({ onNext, onBack, onStepClick, selectedDate }: GuestsStepProps) => {
  const { config } = useRestaurantConfig();
  const guestOptions = [2, 3, 4, 5, 6, 7];

  return (
    <div className="max-w-lg mx-auto">
      <StepHeader currentStep="guests" selectedDate={selectedDate} onStepClick={onStepClick} />

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-primary mb-6">¿Cuántos sois?</h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {guestOptions.map((guests) => (
            <Button
              key={guests}
              variant="outline"
              className="h-16 text-lg font-medium hover:bg-primary hover:text-white"
              onClick={() => onNext(guests)}
            >
              {guests}
            </Button>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-amber-800 mb-2">¿Grupo de más de 7 personas?</p>
          <p className="text-xs text-amber-700 mb-3">Para reservas de grupos grandes, contáctanos directamente:</p>
          <a
            href={`mailto:${
              config?.contact_email ?? "info@restaurante-elite.com"
            }?subject=Solicitud de reserva para grupo grande&body=Hola,%0D%0A%0D%0AMe gustaría hacer una reserva para un grupo de más de 7 personas.%0D%0A%0D%0ADetalles:%0D%0A- Número de personas: %0D%0A- Fecha preferida: %0D%0A- Hora preferida: %0D%0A- Ocasión especial (opcional): %0D%0A%0D%0AGracias.`}
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
          >
            Enviar email
          </a>
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={onBack} className="text-primary">
            ← Volver
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuestsStep;
