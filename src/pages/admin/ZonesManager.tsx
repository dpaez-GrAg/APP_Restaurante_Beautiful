import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, GripVertical, MapPin, Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Zone {
  id: string;
  name: string;
  color: string;
  priority_order: number;
  is_active: boolean;
  table_count?: number;
}

const PRESET_COLORS = [
  { name: "Verde", value: "#10B981" },
  { name: "Azul", value: "#3B82F6" },
  { name: "Naranja", value: "#F59E0B" },
  { name: "Rojo", value: "#EF4444" },
  { name: "Morado", value: "#8B5CF6" },
  { name: "Rosa", value: "#EC4899" },
  { name: "Gris", value: "#6B7280" },
  { name: "Cyan", value: "#06B6D4" },
];

const ZonesManager = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [draggedZone, setDraggedZone] = useState<Zone | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6B7280",
  });
  const { toast } = useToast();

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
      toast({
        title: "Error",
        description: "No se pudieron cargar las zonas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim()) {
        toast({
          title: "Error",
          description: "El nombre de la zona es obligatorio",
          variant: "destructive",
        });
        return;
      }

      if (editingZone) {
        const { error } = await supabase.rpc("update_zone", {
          p_zone_id: editingZone.id,
          p_name: formData.name,
          p_color: formData.color,
        });

        if (error) throw error;
        toast({
          title: "Zona actualizada",
          description: "La zona se ha actualizado correctamente",
        });
      } else {
        const { error } = await supabase.rpc("create_zone", {
          p_name: formData.name,
          p_color: formData.color,
        });

        if (error) throw error;
        toast({
          title: "Zona creada",
          description: "La zona se ha creado correctamente",
        });
      }

      setIsDialogOpen(false);
      setEditingZone(null);
      setFormData({ name: "", color: "#6B7280" });
      loadZones();
    } catch (error: any) {
      console.error("Error saving zone:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la zona",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteZoneId) return;

    try {
      const { error } = await supabase.rpc("delete_zone", {
        p_zone_id: deleteZoneId,
      });

      if (error) throw error;

      toast({
        title: "Zona eliminada",
        description: "La zona se ha eliminado correctamente",
      });

      setDeleteZoneId(null);
      loadZones();
    } catch (error: any) {
      console.error("Error deleting zone:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la zona",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (zone: Zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      color: zone.color,
    });
    setIsDialogOpen(true);
  };

  const handleDragStart = (zone: Zone) => {
    setDraggedZone(zone);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetZone: Zone) => {
    if (!draggedZone || draggedZone.id === targetZone.id) {
      setDraggedZone(null);
      return;
    }

    try {
      // Reordenar zonas localmente
      const newZones = [...zones];
      const draggedIndex = newZones.findIndex((z) => z.id === draggedZone.id);
      const targetIndex = newZones.findIndex((z) => z.id === targetZone.id);

      newZones.splice(draggedIndex, 1);
      newZones.splice(targetIndex, 0, draggedZone);

      // Actualizar prioridades
      const zoneIds = newZones.map((z) => z.id);

      const { error } = await supabase.rpc("reorder_zone_priorities", {
        p_zone_ids: zoneIds,
      });

      if (error) throw error;

      toast({
        title: "Prioridades actualizadas",
        description: "El orden de las zonas se ha actualizado",
      });

      loadZones();
    } catch (error: any) {
      console.error("Error reordering zones:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el orden",
        variant: "destructive",
      });
    } finally {
      setDraggedZone(null);
    }
  };

  const openCreateDialog = () => {
    setEditingZone(null);
    setFormData({ name: "", color: "#6B7280" });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando zonas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-restaurant-brown">Gestión de Zonas</h1>
          <p className="text-muted-foreground mt-1">Configura las zonas del restaurante y su prioridad de asignación</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-restaurant-gold hover:bg-restaurant-gold/90">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Zona
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Zonas del Restaurante
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Arrastra las zonas para cambiar su prioridad de asignación (la primera tiene mayor prioridad)
          </p>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay zonas configuradas</p>
              <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                Crear primera zona
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-16">Prioridad</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-32">Color</TableHead>
                  <TableHead className="w-24 text-center">Mesas</TableHead>
                  <TableHead className="w-32 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone, index) => (
                  <TableRow
                    key={zone.id}
                    draggable
                    onDragStart={() => handleDragStart(zone)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(zone)}
                    className={`cursor-move hover:bg-muted/50 ${draggedZone?.id === zone.id ? "opacity-50" : ""}`}
                  >
                    <TableCell>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border-2 border-border"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span className="text-xs text-muted-foreground font-mono">{zone.color}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{zone.table_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(zone)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteZoneId(zone.id)}
                          className="text-destructive hover:text-destructive"
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

      {/* Dialog para crear/editar zona */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? "Editar Zona" : "Nueva Zona"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la zona</Label>
              <Input
                id="name"
                placeholder="Ej: Terraza, Interior, Barra..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Color de identificación</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: preset.value })}
                    className={`h-12 rounded border-2 transition-all hover:scale-105 ${
                      formData.color === preset.value
                        ? "border-restaurant-gold ring-2 ring-restaurant-gold/50"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-8 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">{formData.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-restaurant-gold hover:bg-restaurant-gold/90">
              {editingZone ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={!!deleteZoneId} onOpenChange={() => setDeleteZoneId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar zona?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desasignará todas las mesas de esta zona. Las mesas no se eliminarán, solo quedarán sin zona
              asignada. ¿Deseas continuar?
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
    </div>
  );
};

export default ZonesManager;
