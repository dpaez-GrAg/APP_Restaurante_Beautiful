import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  defaultTableId?: string;
  onSuccess: () => void;
}

interface Schedule {
  opening_time: string;
  closing_time: string;
  is_split?: boolean;
}

interface Zone {
  id: string;
  name: string;
  color: string;
  priority_order: number;
}
export const CreateReservationDialog: React.FC<CreateReservationDialogProps> = ({
  open,
  onOpenChange,
  defaultDate = new Date().toISOString().split("T")[0],
  defaultTime = "20:00",
  defaultTableId,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    date: defaultDate,
    time: defaultTime,
    guests: 2,
    special_requests: "",
    preferred_zone_id: null as string | null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  // Update form data when props change (for slot clicking)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      date: defaultDate || prev.date,
      time: defaultTime || prev.time,
    }));
  }, [defaultDate, defaultTime]);

  // Load schedules when date changes
  useEffect(() => {
    if (formData.date) {
      loadSchedulesForDate(formData.date);
    }
  }, [formData.date]);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const { data, error } = await supabase.rpc("get_zones_ordered");
      if (error) throw error;
      setZones((data as Zone[]) || []);
    } catch (error) {
      console.error("Error loading zones:", error);
    }
  };

  const loadSchedulesForDate = async (dateStr: string) => {
    try {
      const date = new Date(dateStr + "T12:00:00");
      const dayOfWeek = date.getDay();

      const { data, error } = await supabase
        .from("restaurant_schedules")
        .select("opening_time, closing_time")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true)
        .order("opening_time");

      if (error) throw error;

      setSchedules((data as Schedule[]) || []);
      generateTimeSlots((data as Schedule[]) || []);
    } catch (error) {
      console.error("Error loading schedules:", error);
      toast.error("Error al cargar horarios");
      setSchedules([]);
      setTimeSlots([]);
    }
  };

  const generateTimeSlots = (schedules: Schedule[]) => {
    if (schedules.length === 0) {
      setTimeSlots([]);
      return;
    }

    const allSlots: string[] = [];

    schedules.forEach((schedule) => {
      const [startHour, startMin] = schedule.opening_time.split(":").map(Number);
      const [endHour, endMin] = schedule.closing_time.split(":").map(Number);

      let currentHour = startHour;
      let currentMin = startMin;

      while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
        const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
        allSlots.push(timeString);

        currentMin += 15;
        if (currentMin >= 60) {
          currentMin = 0;
          currentHour++;
        }
      }
    });

    setTimeSlots(allSlots);
  };

  const renderTimeSlots = () => {
    if (timeSlots.length === 0) {
      return (
        <div className="px-2 py-3 text-xs text-muted-foreground text-center">
          No hay horarios disponibles para esta fecha
        </div>
      );
    }

    // Si hay múltiples schedules, mostrar separados
    if (schedules.length > 1) {
      return (
        <>
          {/* COMIDA */}
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">🍽️ COMIDA</div>
          {timeSlots
            .filter((slot) => {
              const scheduleIndex = schedules.findIndex((s) => {
                const slotTime = slot + ":00";
                return slotTime >= s.opening_time && slotTime <= s.closing_time;
              });
              return scheduleIndex === 0;
            })
            .map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slot}
              </SelectItem>
            ))}

          {/* CENA */}
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b border-t mt-1">🌙 CENA</div>
          {timeSlots
            .filter((slot) => {
              const scheduleIndex = schedules.findIndex((s) => {
                const slotTime = slot + ":00";
                return slotTime >= s.opening_time && slotTime <= s.closing_time;
              });
              return scheduleIndex === 1;
            })
            .map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slot}
              </SelectItem>
            ))}
        </>
      );
    }

    // Horario simple
    return timeSlots.map((slot) => (
      <SelectItem key={slot} value={slot}>
        {slot}
      </SelectItem>
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc("admin_create_reservation", {
        p_name: formData.customerName,
        p_email: null,
        p_phone: formData.customerPhone || null,
        p_date: formData.date,
        p_time: formData.time,
        p_guests: formData.guests,
        p_special_requests: formData.special_requests || "",
        p_duration_minutes: 90,
        p_preferred_zone_id: formData.preferred_zone_id || null,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);

      toast.success("Reserva creada correctamente");
      onSuccess();
      onOpenChange(false);

      // Reset form
      setFormData({
        customerName: "",
        customerPhone: "",
        date: new Date().toISOString().split("T")[0],
        time: defaultTime,
        guests: 2,
        special_requests: "",
        preferred_zone_id: null,
      });
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input
              value={formData.customerName}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
              placeholder="Nombre del cliente"
              required
            />
          </div>

          <div>
            <Label>Teléfono</Label>
            <Input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
              placeholder="Teléfono"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Hora *</Label>
              <Select
                value={formData.time}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, time: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar hora" />
                </SelectTrigger>
                <SelectContent className="max-h-60">{renderTimeSlots()}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Zona preferida (opcional)</Label>
            <Select
              value={formData.preferred_zone_id || "any"}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, preferred_zone_id: value === "any" ? null : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cualquier zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquier zona disponible</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                      {zone.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comensales *</Label>
            <Select
              value={formData.guests.toString()}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, guests: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nº" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, i) => i + 2).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? "persona" : "personas"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Comentarios</Label>
            <Textarea
              value={formData.special_requests}
              onChange={(e) => setFormData((prev) => ({ ...prev, special_requests: e.target.value }))}
              placeholder="Comentarios especiales..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creando..." : "Crear Reserva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
