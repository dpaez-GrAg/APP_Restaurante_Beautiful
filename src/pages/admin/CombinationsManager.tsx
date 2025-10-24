import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { useCombinations } from "@/hooks/useCombinations";
import { CombinationData } from "@/types/combination";
import { CombinationDialog } from "@/components/admin/combinations/CombinationDialog";
import { CombinationTableRow } from "@/components/admin/combinations/CombinationTableRow";

const CombinationsManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCombination, setEditingCombination] = useState<CombinationData | null>(null);
  
  const {
    tables,
    zones,
    combinations,
    isLoading,
    saveCombination,
    deleteCombination,
    toggleActive
  } = useCombinations();

  const handleOpenDialog = (combination: CombinationData | null = null) => {
    setEditingCombination(combination);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCombination(null);
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
        
        <Button onClick={() => handleOpenDialog(null)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Combinación
        </Button>
      </div>

      <CombinationDialog
        open={isDialogOpen}
        onOpenChange={handleCloseDialog}
        editingCombination={editingCombination}
        tables={tables}
        zones={zones}
        onSave={saveCombination}
      />

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
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinations.map((combination) => (
                  <CombinationTableRow
                    key={combination.id}
                    combination={combination}
                    tables={tables}
                    zones={zones}
                    onEdit={handleOpenDialog}
                    onDelete={deleteCombination}
                    onToggleActive={toggleActive}
                  />
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