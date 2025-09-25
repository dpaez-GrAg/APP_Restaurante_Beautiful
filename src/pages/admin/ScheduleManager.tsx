import { useState, useEffect } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface DaySchedule {
  day: number;
  enabled: boolean;
  hasSplit: boolean;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  maxDinersMorning?: number;
  maxDinersAfternoon?: number;
  maxDinersSingle?: number;
}

interface SpecialClosedDay {
  id: string;
  date: Date;
  reason?: string;
  is_range: boolean;
  range_start?: Date;
  range_end?: Date;
}

interface SpecialScheduleDay {
  id: string;
  date: Date;
  opening_time: string;
  closing_time: string;
  reason?: string;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      times.push(timeString);
    }
  }
  return times;
};

const ScheduleManager = () => {
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialClosedDay[]>([]);
  const [specialSchedules, setSpecialSchedules] = useState<SpecialScheduleDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedStartDate, setSelectedStartDate] = useState<Date>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [isRange, setIsRange] = useState(false);
  // Special schedule states
  const [specialDate, setSpecialDate] = useState<Date>();
  const [specialOpenTime, setSpecialOpenTime] = useState("09:00");
  const [specialCloseTime, setSpecialCloseTime] = useState("22:00");
  const [specialReason, setSpecialReason] = useState("");
  const { toast } = useToast();
  const timeOptions = generateTimeOptions();

  useEffect(() => {
    loadSchedules();
    loadSpecialDays();
    loadSpecialSchedules();
  }, []);

  const initializeDaySchedules = () => {
    return DAYS_OF_WEEK.map((day) => ({
      day: day.value,
      enabled: false,
      hasSplit: false,
      morningStart: "09:00",
      morningEnd: "22:00",
      afternoonStart: "15:00",
      afternoonEnd: "22:00",
      maxDinersMorning: undefined,
      maxDinersAfternoon: undefined,
      maxDinersSingle: undefined,
    }));
  };

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase.from("restaurant_schedules").select("*").order("day_of_week");

      if (error) throw error;

      const initialSchedules = initializeDaySchedules();

      // Populate with existing data
      if (data && data.length > 0) {
        data.forEach((schedule) => {
          const dayIndex = initialSchedules.findIndex((ds) => ds.day === schedule.day_of_week);
          if (dayIndex !== -1) {
            const daySchedules = data.filter((s) => s.day_of_week === schedule.day_of_week);

            if (daySchedules.length === 1) {
              // Single schedule
              initialSchedules[dayIndex] = {
                ...initialSchedules[dayIndex],
                enabled: schedule.is_active,
                hasSplit: false,
                morningStart: schedule.opening_time.substring(0, 5),
                morningEnd: schedule.closing_time.substring(0, 5),
                maxDinersSingle: schedule.max_diners,
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
                afternoonEnd: sortedSchedules[1].closing_time.substring(0, 5),
                maxDinersMorning: sortedSchedules[0].max_diners,
                maxDinersAfternoon: sortedSchedules[1].max_diners,
              };
            }
          }
        });
      }

      setDaySchedules(initialSchedules);
    } catch (error) {
      console.error("Error loading schedules:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSchedules = async () => {
    try {
      // Delete all existing schedules
      await supabase.from("restaurant_schedules").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      // Insert new schedules
      const schedulesToInsert = [];

      daySchedules.forEach((daySchedule) => {
        if (daySchedule.enabled) {
          if (daySchedule.hasSplit) {
            // Add morning schedule
            schedulesToInsert.push({
              day_of_week: daySchedule.day,
              opening_time: daySchedule.morningStart,
              closing_time: daySchedule.morningEnd,
              is_active: true,
              max_diners: daySchedule.maxDinersMorning,
            });
            // Add afternoon schedule
            schedulesToInsert.push({
              day_of_week: daySchedule.day,
              opening_time: daySchedule.afternoonStart,
              closing_time: daySchedule.afternoonEnd,
              is_active: true,
              max_diners: daySchedule.maxDinersAfternoon,
            });
          } else {
            // Add single schedule
            schedulesToInsert.push({
              day_of_week: daySchedule.day,
              opening_time: daySchedule.morningStart,
              closing_time: daySchedule.morningEnd,
              is_active: true,
              max_diners: daySchedule.maxDinersSingle,
            });
          }
        }
      });

      if (schedulesToInsert.length > 0) {
        const { error } = await supabase.from("restaurant_schedules").insert(schedulesToInsert);

        if (error) throw error;
      }

      toast({
        title: "Horarios guardados",
        description: "Los horarios se han actualizado correctamente",
      });

      await loadSchedules();
    } catch (error) {
      console.error("Error saving schedules:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los horarios",
        variant: "destructive",
      });
    }
  };

  const loadSpecialDays = async () => {
    try {
      const { data, error } = await supabase.from("special_closed_days").select("*").order("date");

      if (error) throw error;

      const formattedDays =
        data?.map((day) => ({
          ...day,
          date: new Date(day.date),
          range_start: day.range_start ? new Date(day.range_start) : undefined,
          range_end: day.range_end ? new Date(day.range_end) : undefined,
        })) || [];

      setSpecialDays(formattedDays);
    } catch (error) {
      console.error("Error loading special days:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los días especiales",
        variant: "destructive",
      });
    }
  };

  const addSpecialDay = async () => {
    try {
      if (isRange && (!selectedStartDate || !selectedEndDate)) {
        toast({
          title: "Error",
          description: "Selecciona las fechas de inicio y fin para el rango",
          variant: "destructive",
        });
        return;
      }

      if (!isRange && !selectedDate) {
        toast({
          title: "Error",
          description: "Selecciona una fecha",
          variant: "destructive",
        });
        return;
      }

      // Helper function to format date as YYYY-MM-DD in local timezone
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const newDay = {
        date: formatDateLocal(isRange ? selectedStartDate! : selectedDate!),
        reason: reason || null,
        is_range: isRange,
        range_start: isRange ? formatDateLocal(selectedStartDate!) : null,
        range_end: isRange ? formatDateLocal(selectedEndDate!) : null,
      };

      const { error } = await supabase.from("special_closed_days").insert(newDay);

      if (error) throw error;

      toast({
        title: "Día especial añadido",
        description: "El día de cierre se ha guardado correctamente",
      });

      setSelectedDate(undefined);
      setSelectedStartDate(undefined);
      setSelectedEndDate(undefined);
      setReason("");
      setIsRange(false);
      await loadSpecialDays();
    } catch (error) {
      console.error("Error adding special day:", error);
      toast({
        title: "Error",
        description: "No se pudo añadir el día especial",
        variant: "destructive",
      });
    }
  };

  const deleteSpecialDay = async (id: string) => {
    try {
      const { error } = await supabase.from("special_closed_days").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Día especial eliminado",
        description: "El día de cierre se ha eliminado correctamente",
      });

      await loadSpecialDays();
    } catch (error) {
      console.error("Error deleting special day:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el día especial",
        variant: "destructive",
      });
    }
  };

  const loadSpecialSchedules = async () => {
    try {
      const { data, error } = await supabase.from("special_schedule_days").select("*").order("date");

      if (error) throw error;

      const formattedSchedules =
        data?.map((schedule) => ({
          ...schedule,
          date: new Date(schedule.date),
          opening_time: schedule.opening_time.substring(0, 5),
          closing_time: schedule.closing_time.substring(0, 5),
        })) || [];

      setSpecialSchedules(formattedSchedules);
    } catch (error) {
      console.error("Error loading special schedules:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios especiales",
        variant: "destructive",
      });
    }
  };

  const addSpecialSchedule = async () => {
    try {
      if (!specialDate) {
        toast({
          title: "Error",
          description: "Selecciona una fecha",
          variant: "destructive",
        });
        return;
      }

      // Helper function to format date as YYYY-MM-DD in local timezone
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const newSchedule = {
        date: formatDateLocal(specialDate),
        opening_time: specialOpenTime,
        closing_time: specialCloseTime,
        reason: specialReason || null,
        is_active: true,
      };

      const { error } = await supabase.from("special_schedule_days").insert(newSchedule);

      if (error) throw error;

      toast({
        title: "Horario especial añadido",
        description: "El horario especial se ha guardado correctamente",
      });

      setSpecialDate(undefined);
      setSpecialOpenTime("09:00");
      setSpecialCloseTime("22:00");
      setSpecialReason("");
      await loadSpecialSchedules();
    } catch (error) {
      console.error("Error adding special schedule:", error);
      toast({
        title: "Error",
        description: "No se pudo añadir el horario especial",
        variant: "destructive",
      });
    }
  };

  const deleteSpecialSchedule = async (id: string) => {
    try {
      const { error } = await supabase.from("special_schedule_days").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Horario especial eliminado",
        description: "El horario especial se ha eliminado correctamente",
      });

      await loadSpecialSchedules();
    } catch (error) {
      console.error("Error deleting special schedule:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el horario especial",
        variant: "destructive",
      });
    }
  };

  const updateDaySchedule = (dayIndex: number, updates: Partial<DaySchedule>) => {
    setDaySchedules((prev) =>
      prev.map((schedule, index) => (index === dayIndex ? { ...schedule, ...updates } : schedule))
    );
  };

  const getDayName = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.label || "Desconocido";
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-restaurant-brown">Configuración de Horarios</h1>
        <p className="text-muted-foreground">Gestiona los horarios de atención del restaurante</p>
      </div>

      {/* Grid principal con 3 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1: Horarios por día */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">Horarios Semanales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {daySchedules.map((daySchedule, index) => (
                  <div key={daySchedule.day} className="border rounded-lg p-3 space-y-3">
                    {/* Header del día */}
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{getDayName(daySchedule.day)}</span>
                      <Checkbox
                        checked={daySchedule.enabled}
                        onCheckedChange={(checked) => updateDaySchedule(index, { enabled: checked as boolean })}
                      />
                    </div>

                    {daySchedule.enabled && (
                      <div className="space-y-3">
                        {/* Toggle horario dividido */}
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`split-${daySchedule.day}`}
                            checked={daySchedule.hasSplit}
                            onCheckedChange={(checked) => updateDaySchedule(index, { hasSplit: checked as boolean })}
                          />
                          <Label htmlFor={`split-${daySchedule.day}`} className="text-xs text-muted-foreground">
                            Horario dividido
                          </Label>
                        </div>

                        {/* Horarios */}
                        {!daySchedule.hasSplit ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={daySchedule.morningStart}
                                onValueChange={(value) => updateDaySchedule(index, { morningStart: value })}
                              >
                                <SelectTrigger className="h-8">
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
                              <Select
                                value={daySchedule.morningEnd}
                                onValueChange={(value) => updateDaySchedule(index, { morningEnd: value })}
                              >
                                <SelectTrigger className="h-8">
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
                            <Input
                              type="number"
                              value={daySchedule.maxDinersSingle}
                              onChange={(e) => updateDaySchedule(index, { maxDinersSingle: parseInt(e.target.value) })}
                              placeholder="Max. comensales"
                              className="h-8"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Mañana */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Mañana</Label>
                              <div className="grid grid-cols-3 gap-1 mt-1">
                                <Select
                                  value={daySchedule.morningStart}
                                  onValueChange={(value) => updateDaySchedule(index, { morningStart: value })}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={time} value={time} className="text-xs">
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={daySchedule.morningEnd}
                                  onValueChange={(value) => updateDaySchedule(index, { morningEnd: value })}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={time} value={time} className="text-xs">
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={daySchedule.maxDinersMorning}
                                  onChange={(e) =>
                                    updateDaySchedule(index, { maxDinersMorning: parseInt(e.target.value) })
                                  }
                                  placeholder="Max"
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                            {/* Tarde */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Tarde</Label>
                              <div className="grid grid-cols-3 gap-1 mt-1">
                                <Select
                                  value={daySchedule.afternoonStart}
                                  onValueChange={(value) => updateDaySchedule(index, { afternoonStart: value })}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={time} value={time} className="text-xs">
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={daySchedule.afternoonEnd}
                                  onValueChange={(value) => updateDaySchedule(index, { afternoonEnd: value })}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={time} value={time} className="text-xs">
                                        {time}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={daySchedule.maxDinersAfternoon}
                                  onChange={(e) =>
                                    updateDaySchedule(index, { maxDinersAfternoon: parseInt(e.target.value) })
                                  }
                                  placeholder="Max"
                                  className="h-7 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <UIButton onClick={saveSchedules} className="w-full">
                  Guardar Horarios
                </UIButton>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna 2: Días especiales y horarios especiales */}
        <div className="space-y-6">
          {/* Días de cierre */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">🚫 Días de Cierre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1">
                <UIButton
                  onClick={() => setIsRange(false)}
                  variant={!isRange ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Día
                </UIButton>
                <UIButton
                  onClick={() => setIsRange(true)}
                  variant={isRange ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Rango
                </UIButton>
              </div>

              <div className="space-y-2 border rounded p-2">
                {!isRange ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <UIButton
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left h-8 text-xs",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Fecha"}
                      </UIButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <UIButton
                          variant="outline"
                          className={cn("justify-start h-8 text-xs", !selectedStartDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {selectedStartDate ? format(selectedStartDate, "dd/MM") : "Inicio"}
                        </UIButton>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedStartDate}
                          onSelect={setSelectedStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <UIButton
                          variant="outline"
                          className={cn("justify-start h-8 text-xs", !selectedEndDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {selectedEndDate ? format(selectedEndDate, "dd/MM") : "Fin"}
                        </UIButton>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={selectedEndDate} onSelect={setSelectedEndDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="h-8 text-xs"
                />

                <UIButton onClick={addSpecialDay} size="sm" className="w-full">
                  ➕ Añadir
                </UIButton>
              </div>

              {specialDays.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {specialDays.map((day) => (
                    <div key={day.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                      <div className="text-xs min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {day.is_range && day.range_start && day.range_end
                            ? `${format(day.range_start, "dd/MM")} - ${format(day.range_end, "dd/MM")}`
                            : format(day.date, "dd/MM/yyyy")}
                        </div>
                        {day.reason && <div className="text-muted-foreground truncate">{day.reason}</div>}
                      </div>
                      <UIButton
                        onClick={() => deleteSpecialDay(day.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </UIButton>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Horarios especiales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">⏰ Horarios Especiales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 border rounded p-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <UIButton
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left h-8 text-xs",
                        !specialDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {specialDate ? format(specialDate, "dd/MM/yyyy") : "Fecha"}
                    </UIButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={specialDate} onSelect={setSpecialDate} initialFocus />
                  </PopoverContent>
                </Popover>

                <div className="grid grid-cols-2 gap-1">
                  <Select value={specialOpenTime} onValueChange={setSpecialOpenTime}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time} className="text-xs">
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={specialCloseTime} onValueChange={setSpecialCloseTime}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((time) => (
                        <SelectItem key={time} value={time} className="text-xs">
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Input
                  value={specialReason}
                  onChange={(e) => setSpecialReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="h-8 text-xs"
                />

                <UIButton onClick={addSpecialSchedule} size="sm" className="w-full">
                  ➕ Añadir Horario
                </UIButton>
              </div>

              {specialSchedules.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {specialSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                      <div className="text-xs min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {format(schedule.date, "dd/MM/yyyy")} • {schedule.opening_time}-{schedule.closing_time}
                        </div>
                        {schedule.reason && <div className="text-muted-foreground truncate">{schedule.reason}</div>}
                      </div>
                      <UIButton
                        onClick={() => deleteSpecialSchedule(schedule.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </UIButton>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ScheduleManager;
