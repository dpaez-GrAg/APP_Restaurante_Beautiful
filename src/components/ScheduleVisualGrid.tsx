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

  // Generar headers de horas (solo horas en punto)
  const generateHourHeaders = () => {
    const hours = [];
    for (let hour = 6; hour <= 23; hour++) {
      hours.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return hours;
  };

  const timeSlots = generateTimeSlots();
  const hourHeaders = generateHourHeaders();

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

  const getSchedulesForDay = (dayOfWeek: number) => {
    return schedules.filter(s => s.day_of_week === dayOfWeek && s.is_active);
  };

  const isTimeInSchedule = (dayOfWeek: number, timeSlot: string) => {
    const daySchedules = getSchedulesForDay(dayOfWeek);
    if (daySchedules.length === 0) return false;

    return daySchedules.some(schedule => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot <= closeTime;
    });
  };

  const toggleTimeSlot = async (dayOfWeek: number, timeSlot: string) => {
    const daySchedules = getSchedulesForDay(dayOfWeek);
    
    // Verificar si el timeSlot está en algún horario existente
    const affectedSchedule = daySchedules.find(schedule => {
      const openTime = schedule.opening_time.substring(0, 5);
      const closeTime = schedule.closing_time.substring(0, 5);
      return timeSlot >= openTime && timeSlot <= closeTime;
    });
    
    if (!affectedSchedule) {
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
      // Modificar horario existente
      const isInRange = isTimeInSchedule(dayOfWeek, timeSlot);
      let newOpenTime = affectedSchedule.opening_time;
      let newCloseTime = affectedSchedule.closing_time;

      if (isInRange) {
        // Si está en el rango, ajustar el rango
        if (timeSlot === affectedSchedule.opening_time.substring(0, 5)) {
          // Mover apertura hacia adelante
          const currentIndex = timeSlots.indexOf(timeSlot);
          if (currentIndex < timeSlots.length - 1) {
            newOpenTime = timeSlots[currentIndex + 1];
          } else {
            // Si es el último slot, eliminar el horario
            try {
              const { error } = await supabase
                .from('restaurant_schedules')
                .delete()
                .eq('id', affectedSchedule.id);
              
              if (error) throw error;
              await loadSchedules();
              toast({
                title: "Horario eliminado",
                description: "Horario eliminado correctamente"
              });
              return;
            } catch (error) {
              console.error('Error deleting schedule:', error);
              toast({
                title: "Error",
                description: "No se pudo eliminar el horario",
                variant: "destructive"
              });
              return;
            }
          }
        } else if (timeSlot === affectedSchedule.closing_time.substring(0, 5)) {
          // Mover cierre hacia atrás
          const currentIndex = timeSlots.indexOf(timeSlot);
          if (currentIndex > 0) {
            newCloseTime = timeSlots[currentIndex - 1];
          } else {
            // Si es el primer slot, eliminar el horario
            try {
              const { error } = await supabase
                .from('restaurant_schedules')
                .delete()
                .eq('id', affectedSchedule.id);
              
              if (error) throw error;
              await loadSchedules();
              toast({
                title: "Horario eliminado",
                description: "Horario eliminado correctamente"
              });
              return;
            } catch (error) {
              console.error('Error deleting schedule:', error);
              toast({
                title: "Error",
                description: "No se pudo eliminar el horario",
                variant: "destructive"
              });
              return;
            }
          }
        }
      } else {
        // Si no está en el rango, expandir el rango
        const openTime = affectedSchedule.opening_time.substring(0, 5);
        const closeTime = affectedSchedule.closing_time.substring(0, 5);
        
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
          .eq('id', affectedSchedule.id);
        
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
        <div className="w-full">
          <div className="grid gap-0 mb-2" style={{ 
            gridTemplateColumns: `80px repeat(${hourHeaders.length}, minmax(30px, 1fr))`,
            maxWidth: '100%'
          }}>
            <div className="p-2 text-sm font-medium text-center bg-muted border">Día</div>
            {hourHeaders.map(time => (
              <div key={time} className="p-1 text-xs font-medium text-center bg-muted border-l border-t border-b">
                {time.substring(0, 2)}h
              </div>
            ))}
          </div>

          {/* Filas de días */}
          <div>
            {DAYS_OF_WEEK.map(day => {
              const daySchedules = getSchedulesForDay(day.value);
              return (
                <div 
                  key={day.value} 
                  className="grid gap-0 border-b" 
                  style={{ gridTemplateColumns: `80px repeat(${timeSlots.length}, minmax(12px, 1fr))` }}
                >
                  {/* Nombre del día */}
                  <div className="p-2 bg-muted text-sm font-medium flex flex-col justify-center border-r border-b">
                    <span className="font-semibold text-xs">{day.label}</span>
                    {daySchedules.map((schedule, index) => (
                      <Badge key={schedule.id} variant="secondary" className="text-xs mt-1">
                        {schedule.opening_time.substring(0, 5)}-{schedule.closing_time.substring(0, 5)}
                      </Badge>
                    ))}
                  </div>
                    
                  {/* Slots de tiempo para este día */}
                  {timeSlots.map(timeSlot => {
                    const isActive = isTimeInSchedule(day.value, timeSlot);
                    
                    return (
                      <Button
                        key={`${day.value}-${timeSlot}`}
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-full p-0 border-r border-b ${
                          isActive 
                            ? 'bg-green-200 hover:bg-green-300 border-green-400' 
                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                        }`}
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
      </CardContent>
    </Card>
  );
};

export default ScheduleVisualGrid;