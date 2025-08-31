import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TableData {
  id: string;
  name: string;
  capacity: number;
}

interface CombinationData {
  id: string;
  name: string;
  table_ids: string[];
  total_capacity: number;
  is_active: boolean;
}

const CombinationsManager = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [combinations, setCombinations] = useState<CombinationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCombination, setEditingCombination] = useState<CombinationData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    table_ids: [] as string[]
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tablesResult, combinationsResult] = await Promise.all([
        supabase.from('tables').select('*').eq('is_active', true).order('name'),
        supabase.from('table_combinations').select('*').order('name')
      ]);
      
      if (tablesResult.error) throw tablesResult.error;
      if (combinationsResult.error) throw combinationsResult.error;
      
      setTables(tablesResult.data || []);
      setCombinations(combinationsResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotalCapacity = (tableIds: string[]) => {
    return tables
      .filter(table => tableIds.includes(table.id))
      .reduce((total, table) => total + table.capacity, 0);
  };

  const handleSave = async () => {
    if (formData.table_ids.length < 2) {
      toast({
        title: "Error",
        description: "Selecciona al menos 2 mesas para crear una combinación",
        variant: "destructive"
      });
      return;
    }

    try {
      const totalCapacity = calculateTotalCapacity(formData.table_ids);
      
      if (editingCombination) {
        const { error } = await supabase
          .from('table_combinations')
          .update({
            name: formData.name,
            table_ids: formData.table_ids,
            total_capacity: totalCapacity
          })
          .eq('id', editingCombination.id);
        
        if (error) throw error;
        toast({
          title: "Combinación actualizada",
          description: "La combinación se ha actualizado correctamente"
        });
      } else {
        const { error } = await supabase
          .from('table_combinations')
          .insert([{
            name: formData.name,
            table_ids: formData.table_ids,
            total_capacity: totalCapacity
          }]);
        
        if (error) throw error;
        toast({
          title: "Combinación creada",
          description: "La nueva combinación se ha creado correctamente"
        });
      }
      
      await loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving combination:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la combinación",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta combinación?')) return;
    
    try {
      const { error } = await supabase
        .from('table_combinations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      await loadData();
      toast({
        title: "Combinación eliminada",
        description: "La combinación se ha eliminado correctamente"
      });
    } catch (error) {
      console.error('Error deleting combination:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la combinación",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (combination: CombinationData) => {
    setEditingCombination(combination);
    setFormData({
      name: combination.name,
      table_ids: combination.table_ids
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCombination(null);
    setFormData({
      name: "",
      table_ids: []
    });
  };

  const handleTableToggle = (tableId: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, table_ids: [...formData.table_ids, tableId] });
    } else {
      setFormData({ ...formData, table_ids: formData.table_ids.filter(id => id !== tableId) });
    }
  };

  const getTableNames = (tableIds: string[]) => {
    return tables
      .filter(table => tableIds.includes(table.id))
      .map(table => table.name)
      .join(', ');
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Cargando combinaciones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Combinaciones</h1>
          <p className="text-muted-foreground">Administra las combinaciones de mesas para grupos grandes</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Combinación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCombination ? 'Editar Combinación' : 'Nueva Combinación'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de la combinación</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Combinación VIP"
                />
              </div>
              
              <div>
                <Label>Seleccionar mesas</Label>
                <div className="space-y-2 mt-2">
                  {tables.map((table) => (
                    <div key={table.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={table.id}
                        checked={formData.table_ids.includes(table.id)}
                        onCheckedChange={(checked) => handleTableToggle(table.id, checked as boolean)}
                      />
                      <Label htmlFor={table.id} className="text-sm">
                        {table.name} ({table.capacity} personas)
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              {formData.table_ids.length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Capacidad total: {calculateTotalCapacity(formData.table_ids)} personas
                  </p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingCombination ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Combinaciones de Mesas</CardTitle>
        </CardHeader>
        <CardContent>
          {combinations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay combinaciones configuradas. Crea la primera combinación.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Mesas</TableHead>
                  <TableHead>Capacidad Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinations.map((combination) => (
                  <TableRow key={combination.id}>
                    <TableCell className="font-medium">{combination.name}</TableCell>
                    <TableCell>{getTableNames(combination.table_ids)}</TableCell>
                    <TableCell>{combination.total_capacity} personas</TableCell>
                    <TableCell>
                      <Badge variant={combination.is_active ? "default" : "secondary"}>
                        {combination.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(combination)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(combination.id)}
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

export default CombinationsManager;