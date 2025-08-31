import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScheduleData {
  id: string;
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }
];

const ScheduleManager = () => {
  const [schedules, setSchedules] = useState<ScheduleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleData | null>(null);
  const [formData, setFormData] = useState({
    day_of_week: 1,
    opening_time: "09:00",
    closing_time: "22:00"
  });
  const { toast } = useToast();

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

  const handleSave = async () => {
    // Verificar que no existe ya un horario para ese día
    const existingSchedule = schedules.find(s => 
      s.day_of_week === formData.day_of_week && 
      (!editingSchedule || s.id !== editingSchedule.id)
    );
    
    if (existingSchedule) {
      toast({
        title: "Error",
        description: "Ya existe un horario para ese día de la semana",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from('restaurant_schedules')
          .update({
            day_of_week: formData.day_of_week,
            opening_time: formData.opening_time,
            closing_time: formData.closing_time
          })
          .eq('id', editingSchedule.id);
        
        if (error) throw error;
        toast({
          title: "Horario actualizado",
          description: "El horario se ha actualizado correctamente"
        });
      } else {
        const { error } = await supabase
          .from('restaurant_schedules')
          .insert([{
            day_of_week: formData.day_of_week,
            opening_time: formData.opening_time,
            closing_time: formData.closing_time
          }]);
        
        if (error) throw error;
        toast({
          title: "Horario creado",
          description: "El nuevo horario se ha creado correctamente"
        });
      }
      
      await loadSchedules();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el horario",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este horario?')) return;
    
    try {
      const { error } = await supabase
        .from('restaurant_schedules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await loadSchedules();
      toast({
        title: "Horario eliminado",
        description: "El horario se ha eliminado correctamente"
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el horario",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurant_schedules')
        .update({ is_active: !isActive })
        .eq('id', id);
      
      if (error) throw error;
      
      await loadSchedules();
      toast({
        title: "Estado actualizado",
        description: `Horario ${!isActive ? 'activado' : 'desactivado'} correctamente`
      });
    } catch (error) {
      console.error('Error updating schedule status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (schedule: ScheduleData) => {
    setEditingSchedule(schedule);
    setFormData({
      day_of_week: schedule.day_of_week,
      opening_time: schedule.opening_time,
      closing_time: schedule.closing_time
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setFormData({
      day_of_week: 1,
      opening_time: "09:00",
      closing_time: "22:00"
    });
  };

  const getDayName = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || 'Desconocido';
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Remove seconds
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Cargando horarios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Horarios</h1>
          <p className="text-muted-foreground">Administra los horarios de atención del restaurante</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Horario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="day_of_week">Día de la semana</Label>
                <Select 
                  value={formData.day_of_week.toString()} 
                  onValueChange={(value) => setFormData({ ...formData, day_of_week: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar día" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="opening_time">Hora de apertura</Label>
                  <Input
                    id="opening_time"
                    type="time"
                    value={formData.opening_time}
                    onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="closing_time">Hora de cierre</Label>
                  <Input
                    id="closing_time"
                    type="time"
                    value={formData.closing_time}
                    onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingSchedule ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horarios del Restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay horarios configurados. Crea el primer horario.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{getDayName(schedule.day_of_week)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                        {formatTime(schedule.opening_time)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                        {formatTime(schedule.closing_time)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={schedule.is_active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(schedule.id, schedule.is_active)}
                      >
                        {schedule.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(schedule)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleManager;