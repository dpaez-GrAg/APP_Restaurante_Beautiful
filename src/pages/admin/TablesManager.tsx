import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Move, Layout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface TableData {
  id: string;
  name: string;
  capacity: number;
  min_capacity: number;
  max_capacity: number;
  extra_capacity: number;
  shape: "square" | "round";
  position_x?: number;
  position_y?: number;
  is_active: boolean;
  zone_id?: string | null;
}

interface Zone {
  id: string;
  name: string;
  color: string;
}

const TablesManager = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 2,
    min_capacity: 1,
    max_capacity: 2,
    extra_capacity: 0,
    shape: "square" as "square" | "round",
    position_x: 0,
    position_y: 0,
    zone_id: null as string | null,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadTables();
    loadZones();
  }, []);

  const loadTables = async () => {
    try {
      const { data, error } = await supabase.from("tables").select("*").order("name");

      if (error) throw error;
      setTables((data as TableData[]) || []);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las mesas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      const { data, error } = await supabase.rpc("get_zones_ordered");
      if (error) throw error;
      setZones((data as Zone[]) || []);
    } catch (error) {
      console.error("Error loading zones:", error);
    }
  };

  const handleSave = async () => {
    try {
      if (editingTable) {
        const { error } = await supabase
          .from("tables")
          .update({
            name: formData.name,
            capacity: formData.capacity,
            min_capacity: formData.min_capacity,
            max_capacity: formData.max_capacity,
            extra_capacity: formData.extra_capacity,
            shape: formData.shape,
            position_x: formData.position_x,
            position_y: formData.position_y,
            zone_id: formData.zone_id,
          })
          .eq("id", editingTable.id);

        if (error) throw error;
        toast({
          title: "Mesa actualizada",
          description: "La mesa se ha actualizado correctamente",
        });
      } else {
        const { error } = await supabase.from("tables").insert([
          {
            name: formData.name,
            capacity: formData.capacity,
            min_capacity: formData.min_capacity,
            max_capacity: formData.max_capacity,
            extra_capacity: formData.extra_capacity,
            shape: formData.shape,
            position_x: formData.position_x,
            position_y: formData.position_y,
            zone_id: formData.zone_id,
          },
        ]);

        if (error) throw error;
        toast({
          title: "Mesa creada",
          description: "La nueva mesa se ha creado correctamente",
        });
      }

      await loadTables();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving table:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la mesa",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta mesa?")) return;

    try {
      const { error } = await supabase.from("tables").delete().eq("id", id);

      if (error) throw error;

      await loadTables();
      toast({
        title: "Mesa eliminada",
        description: "La mesa se ha eliminado correctamente",
      });
    } catch (error) {
      console.error("Error deleting table:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la mesa",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase.from("tables").update({ is_active: !currentState }).eq("id", id);

      if (error) throw error;

      await loadTables();
      toast({
        title: !currentState ? "Mesa activada" : "Mesa desactivada",
        description: `La mesa ahora está ${!currentState ? "activa" : "inactiva"}`,
      });
    } catch (error) {
      console.error("Error toggling table status:", error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de la mesa",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (table: TableData) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      capacity: table.capacity,
      min_capacity: table.min_capacity,
      max_capacity: table.max_capacity,
      extra_capacity: table.extra_capacity,
      shape: table.shape,
      position_x: table.position_x || 0,
      position_y: table.position_y || 0,
      zone_id: table.zone_id || null,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTable(null);
    setFormData({
      name: "",
      capacity: 2,
      min_capacity: 1,
      max_capacity: 2,
      extra_capacity: 0,
      shape: "square" as "square" | "round",
      position_x: 0,
      position_y: 0,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Cargando mesas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Mesas</h1>
          <p className="text-muted-foreground">Administra las mesas del restaurante</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/layout")}>
            <Layout className="w-4 h-4 mr-2" />
            Ver Layout
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Mesa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTable ? "Editar Mesa" : "Nueva Mesa"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre de la mesa</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Mesa 1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="capacity">Capacidad Base</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.capacity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFormData({
                          ...formData,
                          capacity: val,
                          max_capacity: Math.max(val, formData.max_capacity),
                        });
                      }}
                    />
                  </div>

                  <div>
                    <Label htmlFor="shape">Forma</Label>
                    <select
                      id="shape"
                      value={formData.shape}
                      onChange={(e) => setFormData({ ...formData, shape: e.target.value as "square" | "round" })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="square">Cuadrada</option>
                      <option value="round">Redonda</option>
                    </select>
                  </div>
                </div>
                {/* Selector de Zona */}
                <div className="space-y-2">
                  <Label htmlFor="zone">Zona (opcional)</Label>
                  <Select
                    value={formData.zone_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, zone_id: value === "none" ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar zona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin zona asignada</SelectItem>
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="min_capacity">Mín. Ocupación</Label>
                    <Input
                      id="min_capacity"
                      type="number"
                      min="1"
                      max={formData.capacity}
                      value={formData.min_capacity}
                      onChange={(e) => setFormData({ ...formData, min_capacity: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_capacity">Máx. Ocupación</Label>
                    <Input
                      id="max_capacity"
                      type="number"
                      min={formData.capacity}
                      max="20"
                      value={formData.max_capacity}
                      onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="extra_capacity">Capacidad Extra</Label>
                    <Input
                      id="extra_capacity"
                      type="number"
                      min="0"
                      max="5"
                      value={formData.extra_capacity}
                      onChange={(e) => setFormData({ ...formData, extra_capacity: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>{editingTable ? "Actualizar" : "Crear"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mesas del Restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay mesas configuradas. Crea la primera mesa.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    {/* COLUMNA 1: NOMBRE */}
                    <TableCell className="font-medium">
                      {table.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({table.shape === "square" ? "⬜" : "⭕"})
                      </span>
                    </TableCell>

                    {/* COLUMNA 2: CAPACIDAD */}
                    <TableCell>
                      <div className="text-sm">
                        <div>Max: {table.capacity}</div>
                        <div>Min: {table.min_capacity}</div>
                        {table.extra_capacity > 0 && (
                          <div className="text-muted-foreground">Extra: +{table.extra_capacity}</div>
                        )}
                      </div>
                    </TableCell>

                    {/* COLUMNA 3: ZONA */}
                    <TableCell>
                      {table.zone_id ? (
                        (() => {
                          const zone = zones.find((z) => z.id === table.zone_id);
                          return zone ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                              <span className="text-sm">{zone.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin zona</span>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin zona</span>
                      )}
                    </TableCell>

                    {/* COLUMNA 4: ESTADO (Badge) */}
                    <TableCell>
                      <Badge variant={table.is_active ? "default" : "secondary"}>
                        {table.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>

                    {/* COLUMNA 5: ACCIONES (Switch + Botones) */}
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-3">
                        {/* Switch para activar/desactivar */}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={table.is_active}
                            onCheckedChange={() => handleToggleActive(table.id, table.is_active)}
                          />
                        </div>

                        {/* Botones de editar y borrar */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(table)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(table.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

export default TablesManager;
