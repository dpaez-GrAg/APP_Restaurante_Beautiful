import { Button } from "@/components/ui/button";
import StepHeader from "./StepHeader";

interface GuestsStepProps {
  onNext: (guests: number) => void;
  onBack: () => void;
}

const GuestsStep = ({ onNext, onBack }: GuestsStepProps) => {
  const guestOptions = [1, 2, 3, 4, 5, 6];

  return (
    <div className="max-w-lg mx-auto">
      <StepHeader currentStep="guests" />
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-primary mb-6">Selecciona una cantidad</h2>
        
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

        <div className="text-center mb-6">
          <Button
            variant="link"
            className="text-primary text-sm"
            onClick={() => {
              // Handle group request - for now just navigate with max guests
              onNext(8);
            }}
          >
            Solicitar grupo
          </Button>
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