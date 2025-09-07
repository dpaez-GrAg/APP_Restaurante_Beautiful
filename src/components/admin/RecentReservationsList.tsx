import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";

interface Reservation {
  id: string;
  name: string;
  date: string;
  time: string;
  guests: number;
  status: string;
}

interface RecentReservationsListProps {
  reservations: Reservation[];
}

export const RecentReservationsList = ({ reservations }: RecentReservationsListProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800">Confirmada</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="text-restaurant-brown flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Reservas Recientes
        </CardTitle>
        <CardDescription>
          Últimas reservas recibidas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="flex items-center justify-between p-3 rounded-lg bg-restaurant-cream/30 hover:bg-restaurant-cream/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-restaurant-gold/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-restaurant-brown" />
                </div>
                <div>
                  <p className="font-medium text-restaurant-brown">
                    {reservation.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reservation.date} • {reservation.time} • {reservation.guests} personas
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(reservation.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};