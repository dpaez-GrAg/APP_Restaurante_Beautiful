import React, { useState } from "react";
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
  });
  const [isLoading, setIsLoading] = useState(false);

  // Update form data when props change (for slot clicking)
  React.useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      date: defaultDate || prev.date,
      time: defaultTime || prev.time,
    }));
  }, [defaultDate, defaultTime]);

  // Generate 15-minute time slots
  const generate15MinuteSlots = () => {
    const slots = [];
    for (let hour = 12; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 23 && minute > 45) break;
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const timeSlots = generate15MinuteSlots();

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
                <SelectContent className="max-h-60">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">🍽️ COMIDA</div>
                  {timeSlots
                    .filter((slot) => {
                      const hour = parseInt(slot.split(":")[0]);
                      return hour >= 12 && hour < 17;
                    })
                    .map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b border-t mt-1">
                    🌙 CENA
                  </div>
                  {timeSlots
                    .filter((slot) => {
                      const hour = parseInt(slot.split(":")[0]);
                      return hour >= 19;
                    })
                    .map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
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

          {/*           <div>
            <Label>Comensales</Label>
            <Input
              type="number"
              min="2"
              max="7"
              value={formData.guests}
              onChange={(e) => setFormData((prev) => ({ ...prev, guests: parseInt(e.target.value) }))}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Para grupos de más de 7 personas, usar el email de contacto del restaurante
            </p>
          </div> */}

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
