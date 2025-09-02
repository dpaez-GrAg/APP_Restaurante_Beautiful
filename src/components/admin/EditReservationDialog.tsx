import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateLocal } from '@/lib/dateUtils';

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
  onUpdate
}) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    guests: 2,
    special_requests: '',
    status: 'confirmed'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (reservation) {
      setFormData({
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        special_requests: reservation.special_requests || '',
        status: reservation.status
      });
    }
  }, [reservation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;

    setIsLoading(true);
    try {
      // Check if date/time changed, use move function
      if (formData.date !== reservation.date || formData.time !== reservation.time) {
        const { data, error } = await supabase.rpc('move_reservation_with_validation', {
          p_reservation_id: reservation.id,
          p_new_date: formData.date,
          p_new_time: formData.time,
          p_duration_minutes: 90
        });

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error);
      }

      // Update other details
      const { data: updateData, error: updateError } = await supabase.rpc('update_reservation_details', {
        p_reservation_id: reservation.id,
        p_guests: formData.guests,
        p_special_requests: formData.special_requests,
        p_status: formData.status
      });

      if (updateError) throw updateError;
      const updateResult = updateData as { success: boolean; error?: string };
      if (!updateResult.success) throw new Error(updateResult.error);

      toast.success('Reserva actualizada correctamente');
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating reservation:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Reserva</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Hora</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label>Comensales</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={formData.guests}
              onChange={(e) => setFormData(prev => ({ ...prev, guests: parseInt(e.target.value) }))}
              required
            />
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
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
            <Label>Comentarios</Label>
            <Textarea
              value={formData.special_requests}
              onChange={(e) => setFormData(prev => ({ ...prev, special_requests: e.target.value }))}
              placeholder="Comentarios especiales..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};