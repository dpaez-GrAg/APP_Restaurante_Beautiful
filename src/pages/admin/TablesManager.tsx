import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Move } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TableData {
  id: string;
  name: string;
  capacity: number;
  position_x?: number;
  position_y?: number;
  is_active: boolean;
}

const TablesManager = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 2,
    position_x: 0,
    position_y: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las mesas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingTable) {
        const { error } = await supabase
          .from('tables')
          .update({
            name: formData.name,
            capacity: formData.capacity,
            position_x: formData.position_x,
            position_y: formData.position_y
          })
          .eq('id', editingTable.id);
        
        if (error) throw error;
        toast({
          title: "Mesa actualizada",
          description: "La mesa se ha actualizado correctamente"
        });
      } else {
        const { error } = await supabase
          .from('tables')
          .insert([{
            name: formData.name,
            capacity: formData.capacity,
            position_x: formData.position_x,
            position_y: formData.position_y
          }]);
        
        if (error) throw error;
        toast({
          title: "Mesa creada",
          description: "La nueva mesa se ha creado correctamente"
        });
      }
      
      await loadTables();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving table:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la mesa",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta mesa?')) return;
    
    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await loadTables();
      toast({
        title: "Mesa eliminada",
        description: "La mesa se ha eliminado correctamente"
      });
    } catch (error) {
      console.error('Error deleting table:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la mesa",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (table: TableData) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      capacity: table.capacity,
      position_x: table.position_x || 0,
      position_y: table.position_y || 0
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTable(null);
    setFormData({
      name: "",
      capacity: 2,
      position_x: 0,
      position_y: 0
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
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTable ? 'Editar Mesa' : 'Nueva Mesa'}
              </DialogTitle>
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
              
              <div>
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position_x">Posición X</Label>
                  <Input
                    id="position_x"
                    type="number"
                    value={formData.position_x}
                    onChange={(e) => setFormData({ ...formData, position_x: parseFloat(e.target.value) })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="position_y">Posición Y</Label>
                  <Input
                    id="position_y"
                    type="number"
                    value={formData.position_y}
                    onChange={(e) => setFormData({ ...formData, position_y: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingTable ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                  <TableHead>Posición</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell>{table.capacity} personas</TableCell>
                    <TableCell>
                      {table.position_x !== null && table.position_y !== null 
                        ? `X: ${table.position_x}, Y: ${table.position_y}`
                        : 'Sin posición'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={table.is_active ? "default" : "secondary"}>
                        {table.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(table)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(table.id)}
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

export default TablesManager;