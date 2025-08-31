import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScheduleData {
  id: string;
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
}

const ScheduleVisualGrid = () => {
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const DAYS_OF_WEEK = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  // Generar slots de tiempo cada 30 minutos desde 06:00 hasta 23:30
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 23 && minute === 30) break;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_schedules')
        .select('*')
        .order('day_of_week');
      
      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getScheduleForDay = (dayOfWeek: number) => {
    return schedules.find(s => s.day_of_week === dayOfWeek && s.is_active);
  };

  const isTimeInSchedule = (dayOfWeek: number, timeSlot: string) => {
    const schedule = getScheduleForDay(dayOfWeek);
    if (!schedule) return false;

    const openTime = schedule.opening_time.substring(0, 5);
    const closeTime = schedule.closing_time.substring(0, 5);
    
    return timeSlot >= openTime && timeSlot <= closeTime;
  };

  const toggleTimeSlot = async (dayOfWeek: number, timeSlot: string) => {
    const schedule = getScheduleForDay(dayOfWeek);
    
    if (!schedule) {
      // Crear nuevo horario
      try {
        const { error } = await supabase
          .from('restaurant_schedules')
          .insert([{
            day_of_week: dayOfWeek,
            opening_time: timeSlot,
            closing_time: timeSlot,
            is_active: true
          }]);
        
        if (error) throw error;
        await loadSchedules();
        toast({
          title: "Horario creado",
          description: "Nuevo horario agregado correctamente"
        });
      } catch (error) {
        console.error('Error creating schedule:', error);
        toast({
          title: "Error",
          description: "No se pudo crear el horario",
          variant: "destructive"
        });
      }
    } else {
      // Actualizar horario existente
      const isInRange = isTimeInSchedule(dayOfWeek, timeSlot);
      let newOpenTime = schedule.opening_time;
      let newCloseTime = schedule.closing_time;

      if (isInRange) {
        // Si está en el rango, ajustar el rango
        if (timeSlot === schedule.opening_time.substring(0, 5)) {
          // Mover apertura hacia adelante
          const currentIndex = timeSlots.indexOf(timeSlot);
          if (currentIndex < timeSlots.length - 1) {
            newOpenTime = timeSlots[currentIndex + 1];
          }
        } else if (timeSlot === schedule.closing_time.substring(0, 5)) {
          // Mover cierre hacia atrás
          const currentIndex = timeSlots.indexOf(timeSlot);
          if (currentIndex > 0) {
            newCloseTime = timeSlots[currentIndex - 1];
          }
        }
      } else {
        // Si no está en el rango, expandir el rango
        const openTime = schedule.opening_time.substring(0, 5);
        const closeTime = schedule.closing_time.substring(0, 5);
        
        if (timeSlot < openTime) {
          newOpenTime = timeSlot;
        } else if (timeSlot > closeTime) {
          newCloseTime = timeSlot;
        }
      }

      try {
        const { error } = await supabase
          .from('restaurant_schedules')
          .update({
            opening_time: newOpenTime,
            closing_time: newCloseTime
          })
          .eq('id', schedule.id);
        
        if (error) throw error;
        await loadSchedules();
        toast({
          title: "Horario actualizado",
          description: "Horario modificado correctamente"
        });
      } catch (error) {
        console.error('Error updating schedule:', error);
        toast({
          title: "Error",
          description: "No se pudo actualizar el horario",
          variant: "destructive"
        });
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando horarios...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Panel Visual de Horarios</CardTitle>
        <p className="text-sm text-muted-foreground">
          Haz clic en las casillas para marcar/desmarcar horarios de apertura
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header con horarios */}
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `100px repeat(${timeSlots.length}, 50px)` }}>
              <div className="p-2 text-sm font-medium text-center">Día / Hora</div>
              {timeSlots.map(time => (
                <div key={time} className="p-1 text-xs font-medium text-center border-l transform -rotate-45">
                  {time}
                </div>
              ))}
            </div>

            {/* Filas de días */}
            <div className="space-y-1">
              {DAYS_OF_WEEK.map(day => {
                const schedule = getScheduleForDay(day.value);
                return (
                  <div 
                    key={day.value} 
                    className="grid gap-1 items-stretch" 
                    style={{ gridTemplateColumns: `100px repeat(${timeSlots.length}, 50px)` }}
                  >
                    {/* Nombre del día */}
                    <div className="p-2 bg-muted rounded text-sm font-medium flex items-center justify-between">
                      <span>{day.label}</span>
                      {schedule && (
                        <Badge variant="secondary" className="text-xs">
                          {schedule.opening_time.substring(0, 5)} - {schedule.closing_time.substring(0, 5)}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Slots de tiempo para este día */}
                    {timeSlots.map(timeSlot => {
                      const isActive = isTimeInSchedule(day.value, timeSlot);
                      
                      return (
                        <Button
                          key={`${day.value}-${timeSlot}`}
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-full p-0 ${
                            isActive 
                              ? 'bg-green-200 hover:bg-green-300 border-green-400' 
                              : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                          } border`}
                          onClick={() => toggleTimeSlot(day.value, timeSlot)}
                        >
                          {isActive && (
                            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Leyenda */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                <span>Horario de apertura</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                <span>Cerrado</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleVisualGrid;