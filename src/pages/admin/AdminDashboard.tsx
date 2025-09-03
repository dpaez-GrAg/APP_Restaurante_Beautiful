import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  todayReservations: number;
  cancelledReservations: number;
  confirmedReservations: number;
  totalTables: number;
  occupancyRate: number;
  totalGuests: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<DashboardStats>({
    todayReservations: 0,
    cancelledReservations: 0,
    confirmedReservations: 0,
    totalTables: 0,
    occupancyRate: 0,
    totalGuests: 0,
  });

  const [recentReservations, setRecentReservations] = useState<any[]>([]);

  const loadDashboardData = async () => {
    try {
      // Cargar reservas del día seleccionado
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          *,
          customers (name, email)
        `)
        .eq('date', selectedDate);

      if (reservationsError) throw reservationsError;

      const confirmedReservations = reservations?.filter(r => r.status === 'confirmed') || [];
      const cancelledReservations = reservations?.filter(r => r.status === 'cancelled') || [];
      const totalGuests = confirmedReservations.reduce((sum, r) => sum + (r.guests || 0), 0);

      // Cargar total de mesas
      const { data: tables, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('is_active', true);

      if (tablesError) throw tablesError;

      const totalTables = tables?.length || 0;
      const occupancyRate = totalTables > 0 ? Math.round((confirmedReservations.length / totalTables) * 100) : 0;

      setStats({
        todayReservations: reservations?.length || 0,
        confirmedReservations: confirmedReservations.length,
        cancelledReservations: cancelledReservations.length,
        totalTables,
        occupancyRate,
        totalGuests,
      });

      // Mostrar las últimas 5 reservas
      const recentReservationsWithCustomers = reservations?.slice(0, 5).map(reservation => ({
        ...reservation,
        name: reservation.customers?.name || 'Sin nombre',
        email: reservation.customers?.email || 'Sin email'
      })) || [];

      setRecentReservations(recentReservationsWithCustomers);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedDate]);

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
    <div className="space-y-6">
      {/* Header */}
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
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
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
              <Card 
                className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer"
                onClick={() => navigate('/admin/reservations')}
              >
                <div className="text-center space-y-2">
                  <Calendar className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Ver Reservas</p>
                </div>
              </Card>
              
              <Card 
                className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer"
                onClick={() => navigate('/admin/schedules')}
              >
                <div className="text-center space-y-2">
                  <Clock className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Configurar Horarios</p>
                </div>
              </Card>
              
              <Card 
                className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer"
                onClick={() => navigate('/admin/tables')}
              >
                <div className="text-center space-y-2">
                  <Users className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Gestionar Mesas</p>
                </div>
              </Card>
              
              <Card 
                className="p-4 border border-restaurant-gold/30 hover:border-restaurant-gold transition-colors cursor-pointer"
                onClick={() => navigate('/admin/settings')}
              >
                <div className="text-center space-y-2">
                  <TrendingUp className="w-8 h-8 text-restaurant-gold mx-auto" />
                  <p className="text-sm font-medium">Configuración</p>
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