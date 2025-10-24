import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CombinationData, CombinationFormData, TableData, Zone, getInitialFormData } from "@/types/combination";
import { calculateTotalCapacity } from "@/lib/combinationsUtils";

interface CombinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCombination: CombinationData | null;
  tables: TableData[];
  zones: Zone[];
  onSave: (formData: CombinationFormData, editingCombination: CombinationData | null) => Promise<boolean>;
}

export const CombinationDialog = ({
  open,
  onOpenChange,
  editingCombination,
  tables,
  zones,
  onSave
}: CombinationDialogProps) => {
  const [formData, setFormData] = useState<CombinationFormData>(getInitialFormData());

  useEffect(() => {
    if (editingCombination) {
      setFormData({
        name: editingCombination.name,
        table_ids: editingCombination.table_ids,
        min_capacity: editingCombination.min_capacity || 1,
        max_capacity: editingCombination.max_capacity || 0,
        extra_capacity: editingCombination.extra_capacity || 0,
        zone_id: editingCombination.zone_id || null
      });
    } else {
      setFormData(getInitialFormData());
    }
  }, [editingCombination, open]);

  const handleTableToggle = (tableId: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, table_ids: [...formData.table_ids, tableId] });
    } else {
      setFormData({ ...formData, table_ids: formData.table_ids.filter(id => id !== tableId) });
    }
  };

  const handleSave = async () => {
    const success = await onSave(formData, editingCombination);
    if (success) {
      onOpenChange(false);
      setFormData(getInitialFormData());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCombination ? 'Editar Combinación' : 'Nueva Combinación'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre de la combinación *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Terraza Grande, Salón Principal..."
              />
            </div>
            
            <div>
              <Label htmlFor="zone">Zona</Label>
              <Select
                value={formData.zone_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, zone_id: value === "none" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin zona</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: zone.color }}
                        />
                        {zone.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selección de mesas */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="text-base font-semibold mb-3 block">
              Seleccionar mesas * (mínimo 2)
            </Label>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay mesas activas disponibles
                </p>
              ) : (
                tables.map((table) => (
                  <div 
                    key={table.id} 
                    className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded transition-colors"
                  >
                    <Checkbox
                      id={table.id}
                      checked={formData.table_ids.includes(table.id)}
                      onCheckedChange={(checked) => handleTableToggle(table.id, checked as boolean)}
                    />
                    <Label 
                      htmlFor={table.id} 
                      className="text-sm cursor-pointer flex-1 font-medium"
                    >
                      {table.name} 
                      <span className="text-muted-foreground font-normal ml-2">
                        ({table.capacity} personas)
                      </span>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Configuración de capacidad */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Configuración de capacidad</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="min_capacity" className="text-sm">
                  Mínimo *
                </Label>
                <Input
                  id="min_capacity"
                  type="number"
                  min="1"
                  value={formData.min_capacity}
                  onChange={(e) => setFormData({ ...formData, min_capacity: parseInt(e.target.value) || 1 })}
                />
                <p className="text-xs text-muted-foreground mt-1">Mín. personas</p>
              </div>
              
              <div>
                <Label htmlFor="max_capacity" className="text-sm">
                  Máximo
                </Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min={formData.min_capacity}
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 0 })}
                  placeholder="0 = sin límite"
                />
                <p className="text-xs text-muted-foreground mt-1">Máx. personas</p>
              </div>
              
              <div>
                <Label htmlFor="extra_capacity" className="text-sm">
                  Extra
                </Label>
                <Input
                  id="extra_capacity"
                  type="number"
                  min="0"
                  value={formData.extra_capacity}
                  onChange={(e) => setFormData({ ...formData, extra_capacity: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">Sillas extra</p>
              </div>
            </div>
          </div>
          
          {/* Resumen de capacidad */}
          {formData.table_ids.length > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">
                    Capacidad total calculada
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.table_ids.length} mesas seleccionadas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {calculateTotalCapacity(formData.table_ids, tables)}
                  </p>
                  <p className="text-xs text-muted-foreground">personas</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="button"
              onClick={handleSave}
              disabled={formData.table_ids.length < 2 || !formData.name.trim()}
            >
              {editingCombination ? 'Actualizar Combinación' : 'Crear Combinación'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
