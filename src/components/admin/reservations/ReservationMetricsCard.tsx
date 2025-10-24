import { Card, CardContent } from "@/components/ui/card";
import { ShiftMetrics } from "@/lib/reservationsUtils";

interface ReservationMetricsCardProps {
  title: string;
  metrics: ShiftMetrics;
}

export const ReservationMetricsCard = ({ title, metrics }: ReservationMetricsCardProps) => {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">{title}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-restaurant-brown">{metrics.reservations}</p>
            <p className="text-[10px] text-muted-foreground">Mesas reservadas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-restaurant-brown">{metrics.guests}</p>
            <p className="text-[10px] text-muted-foreground">Personas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">{metrics.arrived}</p>
            <p className="text-[10px] text-muted-foreground">Mesas recepcionadas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{metrics.cancelled}</p>
            <p className="text-[10px] text-muted-foreground">Mesas canceladas</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
