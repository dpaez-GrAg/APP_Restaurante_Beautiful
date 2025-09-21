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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatDateLocal } from "@/lib/dateUtils";
import { Trash2 } from "lucide-react";

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
    status: "confirmed",
    duration_minutes: 90,
  });
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [availableTables, setAvailableTables] = useState<Array<{ id: string; name: string; capacity: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (reservation) {
      // Get duration from reservation data if available
      let duration = 90; // default

      // Try to get from database field first
      if (reservation.duration_minutes) {
        duration = reservation.duration_minutes;
      } else if (reservation.start_at && reservation.end_at) {
        // Calculate from timestamps as fallback
        const start = new Date(reservation.start_at);
        const end = new Date(reservation.end_at);
        duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }

      setFormData({
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        special_requests: reservation.special_requests || "",
        status: reservation.status,
        duration_minutes: duration,
      });

      // Set currently assigned tables
      const currentTableIds =
        reservation.tableAssignments?.map((t) => t.table_id) ||
        reservation.table_assignments?.map((t) => t.table.id) ||
        [];
      setSelectedTableIds(currentTableIds);

      // Load available tables
      loadAvailableTables();
    }
  }, [reservation]);

  const loadAvailableTables = async () => {
    try {
      const { data, error } = await supabase
        .from("tables")
        .select("id, name, capacity")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setAvailableTables(data || []);
    } catch (error) {
      console.error("Error loading tables:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;

    setIsLoading(true);
    try {
      // Check if tables changed
      const currentTableIds =
        reservation.tableAssignments?.map((t) => t.table_id) ||
        reservation.table_assignments?.map((t) => t.table.id) ||
        [];
      const tablesChanged = JSON.stringify(selectedTableIds.sort()) !== JSON.stringify(currentTableIds.sort());

      // Check if date/time/duration changed, use move function with specific tables if changed
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

        // Include specific tables if manually selected
        if (tablesChanged && selectedTableIds.length > 0) {
          moveParams.p_new_table_ids = selectedTableIds;
        }

        const { data, error } = await supabase.rpc("move_reservation_with_validation", moveParams);

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error);
      }

      // Update guest count with automatic table reassignment if needed (only if tables weren't manually changed)
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

      // Update other details (excluding guests if already handled above)
      const { data: updateData, error: updateError } = await supabase.rpc("update_reservation_details", {
        p_reservation_id: reservation.id,
        p_guests: tablesChanged ? formData.guests : null, // Update guests if tables were manually changed
        p_special_requests: formData.special_requests,
        p_status: formData.status,
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
      // Delete table assignments first
      const { error: assignmentError } = await supabase
        .from("reservation_table_assignments")
        .delete()
        .eq("reservation_id", reservation.id);

      if (assignmentError) throw assignmentError;

      // Delete the reservation
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

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
                <strong>Mesas:</strong>{" "}
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
            <Label>Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="confirmed">Confirmada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Mesas Asignadas</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded p-2">
              {availableTables.map((table) => (
                <div key={table.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`table-${table.id}`}
                    checked={selectedTableIds.includes(table.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTableIds((prev) => [...prev, table.id]);
                      } else {
                        setSelectedTableIds((prev) => prev.filter((id) => id !== table.id));
                      }
                    }}
                  />
                  <Label htmlFor={`table-${table.id}`} className="text-sm">
                    {table.name} ({table.capacity}p)
                  </Label>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Capacidad total:{" "}
              {availableTables.filter((t) => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0)}p
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
