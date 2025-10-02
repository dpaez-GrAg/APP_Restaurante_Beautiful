import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface SlotLimit {
  id: string;
  slot_time: string;
  max_diners: number;
}

interface SlotCapacityConfigProps {
  dayOfWeek: number;
  scheduleType: "single" | "morning" | "afternoon";
  scheduleStart: string;
  scheduleEnd: string;
  maxDinersGlobal?: number;
}

export const SlotCapacityConfig: React.FC<SlotCapacityConfigProps> = ({
  dayOfWeek,
  scheduleType,
  scheduleStart,
  scheduleEnd,
  maxDinersGlobal,
}) => {
  const [slotLimits, setSlotLimits] = useState<SlotLimit[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [slotCapacity, setSlotCapacity] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  useEffect(() => {
    const slots: string[] = [];
    if (!scheduleStart || !scheduleEnd) return;

    const [startHour, startMin] = scheduleStart.split(":").map(Number);
    const [endHour, endMin] = scheduleEnd.split(":").map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
      const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;
      slots.push(timeString);

      currentMin += 15;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }

    setAvailableSlots(slots);
  }, [scheduleStart, scheduleEnd]);

  useEffect(() => {
    loadSlotLimits();
  }, [dayOfWeek, scheduleType]);

  const loadSlotLimits = async () => {
    try {
      const { data, error } = await supabase.rpc("get_slot_limits_for_day", {
        p_day_of_week: dayOfWeek,
      });

      if (error) throw error;

      const filtered = (data || []).filter((limit: any) => limit.schedule_type === scheduleType);
      setSlotLimits(filtered);
    } catch (error) {
      console.error("Error loading slot limits:", error);
    }
  };

  const addSlotLimit = async () => {
    if (!selectedSlot || !slotCapacity) {
      toast.error("Selecciona un slot y capacidad");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("upsert_slot_limit", {
        p_day_of_week: dayOfWeek,
        p_schedule_type: scheduleType,
        p_slot_time: selectedSlot,
        p_max_diners: parseInt(slotCapacity),
      });

      if (error) throw error;

      toast.success("Límite de slot guardado");
      setSelectedSlot("");
      setSlotCapacity("");
      loadSlotLimits();
    } catch (error: any) {
      console.error("Error saving slot limit:", error);
      toast.error(error.message || "Error al guardar límite");
    } finally {
      setIsLoading(false);
    }
  };

  const removeSlotLimit = async (limitId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("delete_slot_limit", {
        p_id: limitId,
      });

      if (error) throw error;

      toast.success("Límite eliminado");
      loadSlotLimits();
    } catch (error: any) {
      console.error("Error deleting slot limit:", error);
      toast.error(error.message || "Error al eliminar");
    } finally {
      setIsLoading(false);
    }
  };

  const totalLimitedCapacity = slotLimits.reduce((sum, limit) => sum + limit.max_diners, 0);
  const remainingCapacity = maxDinersGlobal ? maxDinersGlobal - totalLimitedCapacity : null;

  return (
    <Card className="mt-3 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Límites por horario{" "}
          {scheduleType === "single" ? "Individual" : scheduleType === "morning" ? "comida" : "cena"}
          <Info className="h-3 w-3 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {/* <Label className="text-xs">Añadir límite para horario específico</Label> */}
          <div className="flex gap-1">
            <Select value={selectedSlot} onValueChange={setSelectedSlot}>
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue placeholder="Hora" />
              </SelectTrigger>
              <SelectContent>
                {availableSlots.map((time) => (
                  <SelectItem key={time} value={time} className="text-xs">
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Max"
              value={slotCapacity}
              onChange={(e) => setSlotCapacity(e.target.value)}
              className="w-20 h-7 text-xs"
              min="1"
            />

            <Button onClick={addSlotLimit} disabled={isLoading} size="sm" className="h-7 px-2">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {slotLimits.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Configurados:</Label>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {slotLimits.map((limit) => (
                <div
                  key={limit.id}
                  className="flex justify-between items-center p-1.5 border rounded text-xs bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{limit.slot_time}</span>
                    <span className="text-muted-foreground">Máx: {limit.max_diners}p</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSlotLimit(limit.id)}
                    disabled={isLoading}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {maxDinersGlobal && slotLimits.length > 0 && (
          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
            <div className="flex items-start gap-1">
              <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                <p className="font-medium text-blue-900 dark:text-blue-100">Global: {maxDinersGlobal}p</p>
                <p className="text-blue-700 dark:text-blue-300">Limitados: {totalLimitedCapacity}p</p>
                {remainingCapacity !== null && remainingCapacity >= 0 && (
                  <p className="text-blue-700 dark:text-blue-300">Libres: {remainingCapacity}p</p>
                )}
                {remainingCapacity !== null && remainingCapacity < 0 && (
                  <p className="text-red-600 dark:text-red-400 font-medium">⚠️ Excede capacidad global</p>
                )}
              </div>
            </div>
          </div>
        )}

        {slotLimits.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Sin límites. Usa capacidad global.</p>
        )}
      </CardContent>
    </Card>
  );
};
