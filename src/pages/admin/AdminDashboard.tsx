import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface DashboardStats {
  todayReservations: number;
  pendingReservations: number;
  confirmedReservations: number;
  totalTables: number;
  occupancyRate: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todayReservations: 0,
    pendingReservations: 0,
    confirmedReservations: 0,
    totalTables: 0,
    occupancyRate: 0,
  });

  const [recentReservations, setRecentReservations] = useState([
    {
      id: "1",
      name: "María García",
      email: "maria@email.com",
      date: "2024-01-15",
      time: "20:00",
      guests: 4,
      status: "pending"
    },
    {
      id: "2",
      name: "Carlos López",
      email: "carlos@email.com",
      date: "2024-01-15",
      time: "19:30",
      guests: 2,
      status: "confirmed"
    },
    {
      id: "3",
      name: "Ana Martín",
      email: "ana@email.com",
      date: "2024-01-16",
      time: "21:00",
      guests: 6,
      status: "pending"
    }
  ]);

  useEffect(() => {
    // Aquí cargarás los datos reales desde Supabase
    // Simulamos datos de ejemplo por ahora
    setStats({
      todayReservations: 12,
      pendingReservations: 5,
      confirmedReservations: 7,
      totalTables: 6,
      occupancyRate: 75,
    });
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800">Confirmada</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Cancelada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-restaurant-brown">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general de tu restaurante
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Última actualización: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reservas Hoy
            </CardTitle>
            <Calendar className="h-4 w-4 text-restaurant-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-restaurant-brown">
              {stats.todayReservations}
            </div>
            <p className="text-xs text-muted-foreground">
              +2 desde ayer
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pendingReservations}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren confirmación
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
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
              Listas para hoy
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
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

      {/* Recent Reservations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {recentReservations.map((reservation) => (
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

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="text-restaurant-brown">Acciones Rápidas</CardTitle>
            <CardDescription>
              Gestiona tu restaurante
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer">
                <div className="text-center space-y-2">
                  <Calendar className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Ver Reservas</p>
                </div>
              </Card>
              
              <Card className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer">
                <div className="text-center space-y-2">
                  <Clock className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Configurar Horarios</p>
                </div>
              </Card>
              
              <Card className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer">
                <div className="text-center space-y-2">
                  <Users className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Gestionar Mesas</p>
                </div>
              </Card>
              
              <Card className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer">
                <div className="text-center space-y-2">
                  <TrendingUp className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Ver Reportes</p>
                </div>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;