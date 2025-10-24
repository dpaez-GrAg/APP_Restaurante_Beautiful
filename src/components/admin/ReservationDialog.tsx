/**
 * Unified Reservation Dialog - Handles both Create and Edit modes
 * Consolidates CreateReservationDialog.tsx and EditReservationDialog.tsx
 * Reduces ~1200 lines to ~600 lines
 */

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Wand2, ListChecks } from "lucide-react";
import { Reservation, Schedule } from "@/types/reservation";
import { Zone, TableWithAvailability } from "@/types/table";
import { useTimeSlots } from "@/hooks/reservations";

type DialogMode = "create" | "edit";

interface ReservationDialogProps {
  mode: DialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  // Create mode props
  defaultDate?: string;
  defaultTime?: string;
  // Edit mode props
  reservation?: Reservation | null;
}

export const ReservationDialog: React.FC<ReservationDialogProps> = ({
  mode,
  open,
  onOpenChange,
  onSuccess,
  defaultDate = new Date().toISOString().split("T")[0],
  defaultTime = "20:00",
  reservation,
}) => {
  const isEditMode = mode === "edit";
  const isCreateMode = mode === "create";

  // Form state
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    date: defaultDate,
    time: defaultTime,
    guests: 2,
    special_requests: "",
    duration_minutes: 90,
    preferred_zone_id: null as string | null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);

  // Table assignment state
  const [assignmentMode, setAssignmentMode] = useState<"automatic" | "manual">(
    isEditMode ? "manual" : "automatic"
  );
  const [availableTables, setAvailableTables] = useState<TableWithAvailability[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);

  // Use centralized time slots hook
  const { schedules, timeSlots, loadSchedules } = useTimeSlots({
    date: formData.date,
    autoLoad: true,
  });

  // Initialize form data for edit mode
  useEffect(() => {
    if (isEditMode && reservation) {
      let duration = 90;
      if (reservation.duration_minutes) {
        duration = reservation.duration_minutes;
      } else if (reservation.start_at && reservation.end_at) {
        const start = new Date(reservation.start_at);
        const end = new Date(reservation.end_at);
        duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }

      // Normalize time to HH:MM format (remove seconds if present)
      const normalizedTime = reservation.time.substring(0, 5);

      setFormData({
        customerName: reservation.customer_name || "",
        customerPhone: reservation.phone || "",
        date: reservation.date,
        time: normalizedTime,
        guests: reservation.guests,
        special_requests: reservation.special_requests || "",
        duration_minutes: duration,
        preferred_zone_id: null,
      });

      const currentTableIds = reservation.tableAssignments?.map((t) => t.table_id) || [];
      setSelectedTableIds(currentTableIds);
      setAssignmentMode(currentTableIds.length > 0 ? "manual" : "automatic");
    } else if (isCreateMode) {
      // Reset for create mode
      setFormData({
        customerName: "",
        customerPhone: "",
        date: defaultDate,
        time: defaultTime,
        guests: 2,
        special_requests: "",
        duration_minutes: 90,
        preferred_zone_id: null,
      });
      setSelectedTableIds([]);
      setAssignmentMode("automatic");
    }
  }, [mode, reservation, isEditMode, isCreateMode, defaultDate, defaultTime]);

  // Update form when default date/time change (create mode)
  useEffect(() => {
    if (isCreateMode) {
      setFormData((prev) => ({
        ...prev,
        date: defaultDate || prev.date,
        time: defaultTime || prev.time,
      }));
    }
  }, [defaultDate, defaultTime, isCreateMode]);

  // Load zones
  useEffect(() => {
    loadZones();
  }, []);

  // Load available tables for manual mode
  useEffect(() => {
    if (assignmentMode === "manual" && formData.date && formData.time) {
      loadAvailableTables();
    }
  }, [assignmentMode, formData.date, formData.time, formData.duration_minutes]);

  const loadZones = async () => {
    try {
      const { data, error } = await supabase.rpc("get_zones_ordered");
      if (error) throw error;
      setZones((data as Zone[]) || []);
    } catch (error) {
      console.error("Error loading zones:", error);
    }
  };

  const loadAvailableTables = async () => {
    setLoadingTables(true);
    try {
      const { data, error } = await supabase.rpc("get_available_tables_for_reservation", {
        p_date: formData.date,
        p_time: formData.time,
        p_duration_minutes: formData.duration_minutes,
      });

      if (error) throw error;
      setAvailableTables((data as TableWithAvailability[]) || []);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast.error("Error al cargar mesas disponibles");
      setAvailableTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const toggleTableSelection = (tableId: string) => {
    setSelectedTableIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    );
  };

  const getSelectedCapacity = () => {
    return availableTables
      .filter((table) => selectedTableIds.includes(table.table_id))
      .reduce((sum, table) => sum + table.total_capacity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isCreateMode) {
        await handleCreate();
      } else if (isEditMode && reservation) {
        await handleUpdate();
      }

      toast.success(isCreateMode ? "Reserva creada correctamente" : "Reserva actualizada correctamente");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(`Error ${isCreateMode ? "creating" : "updating"} reservation:`, error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (assignmentMode === "automatic") {
      const { data, error } = await supabase.rpc("admin_create_reservation", {
        p_name: formData.customerName,
        p_email: null,
        p_phone: formData.customerPhone || null,
        p_date: formData.date,
        p_time: formData.time,
        p_guests: formData.guests,
        p_special_requests: formData.special_requests || "",
        p_duration_minutes: formData.duration_minutes,
        p_preferred_zone_id: formData.preferred_zone_id || null,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
    } else {
      const { data, error } = await supabase.rpc("admin_create_reservation_manual_tables", {
        p_name: formData.customerName,
        p_email: null,
        p_phone: formData.customerPhone || null,
        p_date: formData.date,
        p_time: formData.time,
        p_guests: formData.guests,
        p_table_ids: selectedTableIds.length > 0 ? selectedTableIds : null,
        p_special_requests: formData.special_requests || "",
        p_duration_minutes: formData.duration_minutes,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
    }
  };

  const handleUpdate = async () => {
    if (!reservation) return;

    const currentTableIds = reservation.tableAssignments?.map((t) => t.table_id) || [];
    const tablesChanged = JSON.stringify(selectedTableIds.sort()) !== JSON.stringify(currentTableIds.sort());

    // Update date/time/duration or tables if changed
    if (
      formData.date !== reservation.date ||
      formData.time !== reservation.time ||
      formData.duration_minutes !== (reservation.duration_minutes || 90) ||
      tablesChanged
    ) {
      const moveParams: any = {
        p_reservation_id: reservation.id,
        p_new_date: formData.date,
        p_new_time: formData.time,
        p_duration_minutes: formData.duration_minutes,
      };

      if (assignmentMode === "manual" && selectedTableIds.length > 0) {
        moveParams.p_new_table_ids = selectedTableIds;
      }

      const { data, error } = await supabase.rpc("move_reservation_with_validation", moveParams);
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
    }

    // Update guests and/or special requests using update_reservation_details
    // This function handles both fields
    const { data, error } = await supabase.rpc("update_reservation_details", {
      p_reservation_id: reservation.id,
      p_guests: formData.guests !== reservation.guests ? formData.guests : null,
      p_special_requests: formData.special_requests !== reservation.special_requests ? formData.special_requests : null,
      p_status: null,
    });

    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error);
  };

  const handleDelete = async () => {
    if (!reservation) return;

    setIsDeleting(true);
    try {
      const { error: assignmentError } = await supabase
        .from("reservation_table_assignments")
        .delete()
        .eq("reservation_id", reservation.id);

      if (assignmentError) throw assignmentError;

      const { error: reservationError } = await supabase.from("reservations").delete().eq("id", reservation.id);

      if (reservationError) throw reservationError;

      toast.success("Reserva eliminada correctamente");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting reservation:", error);
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderTimeSlots = () => {
    if (timeSlots.length === 0) {
      return (
        <div className="px-2 py-3 text-xs text-muted-foreground text-center">
          No hay horarios disponibles para esta fecha
        </div>
      );
    }

    if (schedules.length > 1) {
      return (
        <>
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

    return timeSlots.map((slot) => (
      <SelectItem key={slot} value={slot}>
        {slot}
      </SelectItem>
    ));
  };

  const renderTablesList = () => {
    if (loadingTables) {
      return <div className="text-sm text-muted-foreground text-center py-4">Cargando mesas...</div>;
    }

    if (availableTables.length === 0) {
      return (
        <div className="text-sm text-muted-foreground text-center py-4">
          No hay mesas disponibles para esta fecha y hora
        </div>
      );
    }

    const groupedByZone = availableTables.reduce((acc, table) => {
      const zoneName = table.zone_name || "Sin zona";
      if (!acc[zoneName]) acc[zoneName] = [];
      acc[zoneName].push(table);
      return acc;
    }, {} as Record<string, TableWithAvailability[]>);

    return (
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {Object.entries(groupedByZone).map(([zoneName, tables]) => (
          <div key={zoneName}>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
              {tables[0].zone_color && (
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tables[0].zone_color }} />
              )}
              {zoneName}
            </div>
            <div className="space-y-1">
              {tables.map((table) => (
                <label
                  key={table.table_id}
                  className={`flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-accent transition-colors ${
                    !table.is_available ? "opacity-50 cursor-not-allowed" : ""
                  } ${selectedTableIds.includes(table.table_id) ? "bg-accent border-primary" : ""}`}
                >
                  <Checkbox
                    checked={selectedTableIds.includes(table.table_id)}
                    onCheckedChange={() => table.is_available && toggleTableSelection(table.table_id)}
                    disabled={!table.is_available && !selectedTableIds.includes(table.table_id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {table.table_name}
                      {!table.is_available && <span className="text-xs text-destructive ml-2">(Ocupada)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Capacidad: {table.capacity}
                      {table.extra_capacity > 0 && ` (+${table.extra_capacity})`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}

        {selectedTableIds.length > 0 && (
          <div className="sticky bottom-0 bg-background pt-2 border-t">
            <div className="text-sm font-medium">
              {selectedTableIds.length} mesa{selectedTableIds.length > 1 ? "s" : ""} seleccionada
              {selectedTableIds.length > 1 ? "s" : ""} • Capacidad total: {getSelectedCapacity()} personas
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "Nueva Reserva" : "Editar Reserva"}</DialogTitle>
          {isEditMode && reservation && (
            <div className="text-sm text-muted-foreground space-y-1 bg-muted/30 p-3 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <strong>Cliente:</strong> {reservation.customer_name}
                </div>
                {reservation.phone && (
                  <div>
                    <strong>Teléfono:</strong> {reservation.phone}
                  </div>
                )}
              </div>
              {reservation.email && (
                <div>
                  <strong>Email:</strong> {reservation.email}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isCreateMode && (
            <>
              <div>
                <Label>Nombre *</Label>
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
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha *</Label>
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
                  <SelectValue placeholder="Selecciona una hora para la reserva">
                    {formData.time || "Selecciona una hora para la reserva"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">{renderTimeSlots()}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Comensales *</Label>
              <Select
                value={formData.guests.toString()}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, guests: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nº de personas" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 98 }, (_, i) => i + 2).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? "persona" : "personas"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEditMode && (
              <div>
                <Label>Duración (minutos) *</Label>
                <Input
                  type="number"
                  min="30"
                  max="240"
                  step="15"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                  required
                />
              </div>
            )}
          </div>

          <div>
            <Label>Asignación de mesas</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={assignmentMode === "automatic" ? "default" : "outline"}
                onClick={() => setAssignmentMode("automatic")}
                className="flex-1"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Automática
              </Button>
              <Button
                type="button"
                variant={assignmentMode === "manual" ? "default" : "outline"}
                onClick={() => setAssignmentMode("manual")}
                className="flex-1"
              >
                <ListChecks className="w-4 h-4 mr-2" />
                Manual
              </Button>
            </div>
          </div>

          {assignmentMode === "automatic" && (
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
          )}

          {assignmentMode === "manual" && (
            <div>
              <Label>Seleccionar mesas</Label>
              <div className="mt-2 border rounded-md p-3">{renderTablesList()}</div>
            </div>
          )}

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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            {isEditMode && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. La reserva será eliminada permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (isCreateMode ? "Creando..." : "Guardando...") : isCreateMode ? "Crear Reserva" : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
