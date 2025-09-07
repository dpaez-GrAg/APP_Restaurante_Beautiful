import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardStatsProps {
  stats: {
    todayReservations: number;
    cancelledReservations: number;
    confirmedReservations: number;
    totalTables: number;
    occupancyRate: number;
    totalGuests: number;
  };
}

export const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <Card 
        className="shadow-elegant hover:shadow-glow transition-all duration-300 cursor-pointer"
        onClick={() => navigate('/admin/reservations')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Reservas del Día
          </CardTitle>
          <Calendar className="h-4 w-4 text-restaurant-gold" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-restaurant-brown">
            {stats.todayReservations}
          </div>
          <p className="text-xs text-muted-foreground">
            Total reservas
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Comensales
          </CardTitle>
          <Users className="h-4 w-4 text-restaurant-gold" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-restaurant-brown">
            {stats.totalGuests}
          </div>
          <p className="text-xs text-muted-foreground">
            Confirmados
          </p>
        </CardContent>
      </Card>

      <Card 
        className="shadow-elegant hover:shadow-glow transition-all duration-300 cursor-pointer"
        onClick={() => navigate('/admin/reservations?status=confirmed')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Confirmadas
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.confirmedReservations}
          </div>
          <p className="text-xs text-muted-foreground">
            Activas
          </p>
        </CardContent>
      </Card>

      <Card 
        className="shadow-elegant hover:shadow-glow transition-all duration-300 cursor-pointer"
        onClick={() => navigate('/admin/reservations?status=cancelled')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Canceladas
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {stats.cancelledReservations}
          </div>
          <p className="text-xs text-muted-foreground">
            Hoy
          </p>
        </CardContent>
      </Card>

      <Card 
        className="shadow-elegant hover:shadow-glow transition-all duration-300 cursor-pointer"
        onClick={() => navigate('/admin/tables/layout')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ocupación
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-restaurant-gold" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-restaurant-brown">
            {stats.occupancyRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            De {stats.totalTables} mesas
          </p>
        </CardContent>
      </Card>
    </div>
  );
};