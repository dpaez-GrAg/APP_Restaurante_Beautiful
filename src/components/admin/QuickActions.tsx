import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Users, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const QuickActions = () => {
  const navigate = useNavigate();

  return (
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
  );
};