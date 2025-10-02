import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EditReservation {
  id: string;
  customer_name?: string;
  name?: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  special_requests?: string;
  duration_minutes?: number;
  start_at?: string;
  end_at?: string;
  table_assignments?: Array<{ table: { id: string; name: string } }>;
  tableAssignments?: Array<{ table_id: string; table_name: string }>;
}

interface EditReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: EditReservation | null;
  onUpdate: () => void;
}

interface TableWithZone {
  id: string;
  name: string;
  capacity: number;
  zone_id: string | null;
  zone_name: string | null;
  zone_color: string | null;
  zone_priority: number | null;
}

export const EditReservationDialog: React.FC<EditReservationDialogProps> = ({
  open,
  onOpenChange,
  reservation,
  onUpdate,
}) => {
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    guests: 2,
    special_requests: "",
    duration_minutes: 90,
  });
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<TableWithZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (reservation) {
      let duration = 90;

      if (reservation.duration_minutes) {
        duration = reservation.duration_minutes;
      } else if (reservation.start_at && reservation.end_at) {
        const start = new Date(reservation.start_at);
        const end = new Date(reservation.end_at);
        duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }

      setFormData({
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        special_requests: reservation.special_requests || "",
        duration_minutes: duration,
      });

      const currentTableIds =
        reservation.tableAssignments?.map((t) => t.table_id) ||
        reservation.table_assignments?.map((t) => t.table.id) ||
        [];
      setSelectedTableIds(currentTableIds);

      loadAvailableTables();
    }
  }, [reservation]);

  const loadAvailableTables = async () => {
    try {
      const { data, error } = await supabase
        .from("tables")
        .select(
          `
          id, 
          name, 
          capacity,
          zone_id,
          zones (
            name,
            color,
            priority_order
          )
        `
        )
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const tablesWithZone: TableWithZone[] = (data || []).map((table: any) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        zone_id: table.zone_id,
        zone_name: table.zones?.name || null,
        zone_color: table.zones?.color || null,
        zone_priority: table.zones?.priority_order || 999,
      }));

      // Ordenar por zona (prioridad) y luego por nombre
      tablesWithZone.sort((a, b) => {
        if (a.zone_priority !== b.zone_priority) {
          return (a.zone_priority || 999) - (b.zone_priority || 999);
        }
        return a.name.localeCompare(b.name);
      });

      setAvailableTables(tablesWithZone);
    } catch (error) {
      console.error("Error loading tables:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;

    setIsLoading(true);
    try {
      const currentTableIds =
        reservation.tableAssignments?.map((t) => t.table_id) ||
        reservation.table_assignments?.map((t) => t.table.id) ||
        [];
      const tablesChanged = JSON.stringify(selectedTableIds.sort()) !== JSON.stringify(currentTableIds.sort());

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

        if (tablesChanged && selectedTableIds.length > 0) {
          moveParams.p_new_table_ids = selectedTableIds;
        }

        const { data, error } = await supabase.rpc("move_reservation_with_validation", moveParams);

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error);
      }

      if (formData.guests !== reservation.guests && !tablesChanged) {
        const { data: guestUpdateData, error: guestUpdateError } = await supabase.rpc(
          "update_reservation_guests_with_reassignment",
          {
            p_reservation_id: reservation.id,
            p_new_guests: formData.guests,
          }
        );

        if (guestUpdateError) throw guestUpdateError;
        const guestUpdateResult = guestUpdateData as { success: boolean; error?: string };
        if (!guestUpdateResult.success) throw new Error(guestUpdateResult.error);
      }

      const { data: updateData, error: updateError } = await supabase.rpc("update_reservation_details", {
        p_reservation_id: reservation.id,
        p_guests: tablesChanged ? formData.guests : null,
        p_special_requests: formData.special_requests,
        p_status: null, // Ya no actualizamos el estado desde aquí
      });

      if (updateError) throw updateError;
      const updateResult = updateData as { success: boolean; error?: string };
      if (!updateResult.success) throw new Error(updateResult.error);

      toast.success("Reserva actualizada correctamente");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating reservation:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
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
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting reservation:", error);
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const addTable = (tableId: string) => {
    if (!selectedTableIds.includes(tableId)) {
      setSelectedTableIds((prev) => [...prev, tableId]);
    }
  };

  const removeTable = (tableId: string) => {
    setSelectedTableIds((prev) => prev.filter((id) => id !== tableId));
  };

  const getSelectedTables = () => {
    return availableTables.filter((t) => selectedTableIds.includes(t.id));
  };

  const getAvailableTablesForSelect = () => {
    return availableTables.filter((t) => !selectedTableIds.includes(t.id));
  };

  if (!reservation) return null;

  // Agrupar mesas por zona para el selector
  const tablesByZone: Record<string, TableWithZone[]> = {};
  getAvailableTablesForSelect().forEach((table) => {
    const zoneName = table.zone_name || "Sin zona";
    if (!tablesByZone[zoneName]) {
      tablesByZone[zoneName] = [];
    }
    tablesByZone[zoneName].push(table);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Reserva</DialogTitle>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Cliente:</strong> {reservation.customer_name || reservation.name || "Sin nombre"}
              </div>
              <div>
                <strong>Email:</strong> {reservation.email}
              </div>
            </div>
            {reservation.phone && (
              <div>
                <strong>Teléfono:</strong> {reservation.phone}
              </div>
            )}
            {(reservation.tableAssignments?.length || reservation.table_assignments?.length) && (
              <div>
                <strong>Mesas actuales:</strong>{" "}
                {(
                  reservation.tableAssignments?.map((t) => t.table_name) ||
                  reservation.table_assignments?.map((t) => t.table.name) ||
                  []
                ).join(", ")}
              </div>
            )}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Hora</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Comensales</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={formData.guests}
                onChange={(e) => setFormData((prev) => ({ ...prev, guests: parseInt(e.target.value) }))}
                required
              />
            </div>
            <div>
              <Label>Duración (minutos)</Label>
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
          </div>

          <div>
            <Label>Mesas Asignadas</Label>

            {/* Mesas seleccionadas */}
            <div className="flex flex-wrap gap-2 mb-2 min-h-[40px] p-2 border rounded bg-muted/30">
              {getSelectedTables().length === 0 ? (
                <span className="text-sm text-muted-foreground">Ninguna mesa seleccionada</span>
              ) : (
                getSelectedTables().map((table) => (
                  <Badge
                    key={table.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                    style={{
                      backgroundColor: table.zone_color || "#94a3b8",
                      color: "#fff",
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white/30" />
                    {table.name} ({table.capacity}p)
                    <button
                      type="button"
                      onClick={() => removeTable(table.id)}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Selector para agregar mesas */}
            <Select onValueChange={(value) => addTable(value)} value="">
              <SelectTrigger>
                <SelectValue placeholder="+ Agregar mesa" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(tablesByZone).length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Todas las mesas están seleccionadas
                  </div>
                ) : (
                  Object.entries(tablesByZone).map(([zoneName, tables]) => (
                    <React.Fragment key={zoneName}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b">{zoneName}</div>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: table.zone_color || "#94a3b8" }}
                            />
                            {table.name} ({table.capacity}p)
                          </div>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="text-xs text-muted-foreground mt-1">
              Capacidad total: {getSelectedTables().reduce((sum, t) => sum + t.capacity, 0)}p
            </div>
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
            <Button type="submit" disabled={isLoading} className="ml-auto">
              {isLoading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
