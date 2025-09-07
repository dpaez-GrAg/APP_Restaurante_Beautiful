import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DashboardHeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export const DashboardHeader = ({ selectedDate, onDateChange }: DashboardHeaderProps) => {
  const goToPreviousDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() - 1);
    onDateChange(currentDate.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + 1);
    onDateChange(currentDate.toISOString().split('T')[0]);
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-restaurant-brown">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de tu restaurante
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="space-y-1">
          <Label htmlFor="date" className="text-sm text-muted-foreground">
            Seleccionar fecha
          </Label>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPreviousDay}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-40"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={goToNextDay}
              className="h-10 w-10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};