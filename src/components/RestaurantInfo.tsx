import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Clock, Star } from "lucide-react";
import { useRestaurantConfig } from "@/contexts/RestaurantConfigContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
const RestaurantInfo = () => {
  const { config } = useRestaurantConfig();
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    const fetchSchedules = async () => {
      const { data } = await supabase
        .from('restaurant_schedules')
        .select('*')
        .eq('is_active', true)
        .order('day_of_week');
      
      if (data) {
        setSchedules(data);
      }
    };

    fetchSchedules();
  }, []);

  const getDayName = (dayOfWeek: number) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayOfWeek];
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Convert HH:MM:SS to HH:MM
  };

  const groupSchedulesByTime = () => {
    // Ordenar por día de la semana empezando en lunes (1)
    const sortedSchedules = schedules.sort((a, b) => {
      const dayA = a.day_of_week === 0 ? 7 : a.day_of_week; // Domingo al final
      const dayB = b.day_of_week === 0 ? 7 : b.day_of_week;
      return dayA - dayB;
    });

    const groups: { [key: string]: number[] } = {};
    
    sortedSchedules.forEach(schedule => {
      const timeKey = `${formatTime(schedule.opening_time)} - ${formatTime(schedule.closing_time)}`;
      if (!groups[timeKey]) {
        groups[timeKey] = [];
      }
      groups[timeKey].push(schedule.day_of_week);
    });

    return Object.entries(groups).map(([timeRange, days]) => {
      const dayNames = days.map(day => getDayName(day));
      let dayRange = '';
      
      if (days.length === 1) {
        dayRange = dayNames[0];
      } else if (days.length === 2 && Math.abs(days[1] - days[0]) === 1) {
        dayRange = `${dayNames[0]} y ${dayNames[1]}`;
      } else {
        // Check for consecutive days
        const consecutiveGroups = [];
        let currentGroup = [days[0]];
        
        for (let i = 1; i < days.length; i++) {
          const prevDay = days[i - 1] === 0 ? 7 : days[i - 1];
          const currentDay = days[i] === 0 ? 7 : days[i];
          
          if (currentDay === prevDay + 1) {
            currentGroup.push(days[i]);
          } else {
            consecutiveGroups.push(currentGroup);
            currentGroup = [days[i]];
          }
        }
        consecutiveGroups.push(currentGroup);
        
        dayRange = consecutiveGroups.map(group => {
          if (group.length === 1) {
            return getDayName(group[0]);
          } else {
            return `${getDayName(group[0])} a ${getDayName(group[group.length - 1])}`;
          }
        }).join(', ');
      }
      
      return { dayRange, timeRange };
    });
  };

  const features = [{
    icon: <Star className="w-6 h-6 text-restaurant-gold" />,
    title: "Cocina de Autor",
    description: "Platos únicos creados por nuestro chef con ingredientes frescos y locales"
  }, {
    icon: <MapPin className="w-6 h-6 text-restaurant-gold" />,
    title: "Ubicación Privilegiada",
    description: "En el corazón de la ciudad, con vistas espectaculares y fácil acceso"
  }, {
    icon: <Clock className="w-6 h-6 text-restaurant-gold" />,
    title: "Horarios Flexibles",
    description: "Abierto todos los días con horarios de almuerzo y cena adaptados a ti"
  }];
  return <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-restaurant-brown mb-4">
            Sobre Nuestro Restaurante
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Más de 20 años creando experiencias gastronómicas únicas, combinando tradición culinaria 
            con innovación moderna en cada plato que servimos.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => <Card key={index} className="text-center shadow-elegant hover:shadow-glow transition-all duration-300 animate-slide-up">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-restaurant-brown">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>)}
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-elegant animate-slide-up">
            <CardHeader>
              <CardTitle className="text-restaurant-brown flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Ubicación y contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">Dirección:</p>
                {config?.contact_address ? (
                  <p className="text-muted-foreground">{config.contact_address}</p>
                ) : (
                  <p className="text-muted-foreground">Dirección no disponible</p>
                )}
              </div>
                            <div>
                <p className="font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contacto:
                </p>
                {config?.contact_phone && (
                  <p className="text-sm text-muted-foreground">{config.contact_phone}</p>
                )}
                {config?.contact_email && (
                  <p className="text-sm text-muted-foreground">{config.contact_email}</p>
                )}
                {!config?.contact_phone && !config?.contact_email && (
                  <p className="text-sm text-muted-foreground">Información de contacto no disponible</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant animate-slide-up">
            <CardHeader>
              <CardTitle className="text-restaurant-brown flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">Horarios de Servicio:</p>
                {schedules.length > 0 ? (
                  groupSchedulesByTime().map((group, index) => (
                    <p key={index} className="text-sm text-muted-foreground">
                      {group.dayRange}: {group.timeRange}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Horarios no disponibles</p>
                )}
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </section>;
};
export default RestaurantInfo;