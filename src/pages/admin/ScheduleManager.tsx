import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DaySchedule {
  day: number;
  enabled: boolean;
  hasSplit: boolean;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
];

const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      times.push(timeString);
    }
  }
  return times;
};

const ScheduleManager = () => {
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const timeOptions = generateTimeOptions();

  useEffect(() => {
    loadSchedules();
  }, []);

  const initializeDaySchedules = () => {
    return DAYS_OF_WEEK.map(day => ({
      day: day.value,
      enabled: false,
      hasSplit: false,
      morningStart: "09:00",
      morningEnd: "22:00",
      afternoonStart: "15:00",
      afternoonEnd: "22:00"
    }));
  };

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_schedules')
        .select('*')
        .order('day_of_week');
      
      if (error) throw error;
      
      const initialSchedules = initializeDaySchedules();
      
      // Populate with existing data
      if (data && data.length > 0) {
        data.forEach(schedule => {
          const dayIndex = initialSchedules.findIndex(ds => ds.day === schedule.day_of_week);
          if (dayIndex !== -1) {
            const daySchedules = data.filter(s => s.day_of_week === schedule.day_of_week);
            
            if (daySchedules.length === 1) {
              // Single schedule
              initialSchedules[dayIndex] = {
                ...initialSchedules[dayIndex],
                enabled: schedule.is_active,
                hasSplit: false,
                morningStart: schedule.opening_time.substring(0, 5),
                morningEnd: schedule.closing_time.substring(0, 5)
              };
            } else if (daySchedules.length === 2) {
              // Split schedule
              const sortedSchedules = daySchedules.sort((a, b) => a.opening_time.localeCompare(b.opening_time));
              initialSchedules[dayIndex] = {
                ...initialSchedules[dayIndex],
                enabled: schedule.is_active,
                hasSplit: true,
                morningStart: sortedSchedules[0].opening_time.substring(0, 5),
                morningEnd: sortedSchedules[0].closing_time.substring(0, 5),
                afternoonStart: sortedSchedules[1].opening_time.substring(0, 5),
                afternoonEnd: sortedSchedules[1].closing_time.substring(0, 5)
              };
            }
          }
        });
      }
      
      setDaySchedules(initialSchedules);
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

  const saveSchedules = async () => {
    try {
      // Delete all existing schedules
      await supabase
        .from('restaurant_schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      // Insert new schedules
      const schedulesToInsert = [];
      
      daySchedules.forEach(daySchedule => {
        if (daySchedule.enabled) {
          if (daySchedule.hasSplit) {
            // Add morning schedule
            schedulesToInsert.push({
              day_of_week: daySchedule.day,
              opening_time: daySchedule.morningStart,
              closing_time: daySchedule.morningEnd,
              is_active: true
            });
            // Add afternoon schedule
            schedulesToInsert.push({
              day_of_week: daySchedule.day,
              opening_time: daySchedule.afternoonStart,
              closing_time: daySchedule.afternoonEnd,
              is_active: true
            });
          } else {
            // Add single schedule
            schedulesToInsert.push({
              day_of_week: daySchedule.day,
              opening_time: daySchedule.morningStart,
              closing_time: daySchedule.morningEnd,
              is_active: true
            });
          }
        }
      });
      
      if (schedulesToInsert.length > 0) {
        const { error } = await supabase
          .from('restaurant_schedules')
          .insert(schedulesToInsert);
        
        if (error) throw error;
      }
      
      toast({
        title: "Horarios guardados",
        description: "Los horarios se han actualizado correctamente"
      });
      
      await loadSchedules();
    } catch (error) {
      console.error('Error saving schedules:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los horarios",
        variant: "destructive"
      });
    }
  };

  const updateDaySchedule = (dayIndex: number, updates: Partial<DaySchedule>) => {
    setDaySchedules(prev => 
      prev.map((schedule, index) => 
        index === dayIndex ? { ...schedule, ...updates } : schedule
      )
    );
  };

  const getDayName = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || 'Desconocido';
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Cargando horarios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Configuración del calendario</h1>
          <p className="text-muted-foreground">Configura los horarios de atención del restaurante</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horarios por día de la semana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {daySchedules.map((daySchedule, index) => (
            <div key={daySchedule.day} className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{getDayName(daySchedule.day)}</h3>
                <Checkbox
                  checked={daySchedule.enabled}
                  onCheckedChange={(checked) => 
                    updateDaySchedule(index, { enabled: checked as boolean })
                  }
                />
              </div>

              {daySchedule.enabled && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`split-${daySchedule.day}`}
                      checked={daySchedule.hasSplit}
                      onCheckedChange={(checked) => 
                        updateDaySchedule(index, { hasSplit: checked as boolean })
                      }
                    />
                    <Label htmlFor={`split-${daySchedule.day}`}>Dividir horario</Label>
                  </div>

                  {!daySchedule.hasSplit ? (
                    // Single schedule
                    <div className="space-y-3">
                      <h4 className="font-medium">Horario</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Inicio</Label>
                          <Select
                            value={daySchedule.morningStart}
                            onValueChange={(value) => 
                              updateDaySchedule(index, { morningStart: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timeOptions.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Fin</Label>
                          <Select
                            value={daySchedule.morningEnd}
                            onValueChange={(value) => 
                              updateDaySchedule(index, { morningEnd: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timeOptions.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Split schedule
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h4 className="font-medium">Horario de mañana</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Inicio</Label>
                            <Select
                              value={daySchedule.morningStart}
                              onValueChange={(value) => 
                                updateDaySchedule(index, { morningStart: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeOptions.map((time) => (
                                  <SelectItem key={time} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Fin</Label>
                            <Select
                              value={daySchedule.morningEnd}
                              onValueChange={(value) => 
                                updateDaySchedule(index, { morningEnd: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeOptions.map((time) => (
                                  <SelectItem key={time} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium">Horario de tarde</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Inicio</Label>
                            <Select
                              value={daySchedule.afternoonStart}
                              onValueChange={(value) => 
                                updateDaySchedule(index, { afternoonStart: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeOptions.map((time) => (
                                  <SelectItem key={time} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Fin</Label>
                            <Select
                              value={daySchedule.afternoonEnd}
                              onValueChange={(value) => 
                                updateDaySchedule(index, { afternoonEnd: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeOptions.map((time) => (
                                  <SelectItem key={time} value={time}>
                                    {time}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          <div className="flex justify-end">
            <Button onClick={saveSchedules} className="bg-primary text-primary-foreground">
              Guardar Horarios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleManager;