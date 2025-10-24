import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2 } from "lucide-react";
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
import { CombinationData, TableData, Zone } from "@/types/combination";
import { getTableNames, getZoneName, getZoneColor } from "@/lib/combinationsUtils";

interface CombinationTableRowProps {
  combination: CombinationData;
  tables: TableData[];
  zones: Zone[];
  onEdit: (combination: CombinationData) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
}

export const CombinationTableRow = ({
  combination,
  tables,
  zones,
  onEdit,
  onDelete,
  onToggleActive
}: CombinationTableRowProps) => {
  return (
    <TableRow>
      {/* COLUMNA 1: NOMBRE */}
      <TableCell className="font-medium">
        {combination.name}
        <span className="ml-2 text-xs text-muted-foreground">
          ({combination.table_ids.length} mesas)
        </span>
      </TableCell>

      {/* COLUMNA 2: MESAS */}
      <TableCell>
        <div className="text-sm text-muted-foreground max-w-xs truncate">
          {getTableNames(combination.table_ids, tables)}
        </div>
      </TableCell>

      {/* COLUMNA 3: CAPACIDAD */}
      <TableCell>
        <div className="text-sm">
          <div>Max: {combination.max_capacity || combination.total_capacity}</div>
          <div>Min: {combination.min_capacity}</div>
          {combination.extra_capacity > 0 && (
            <div className="text-muted-foreground">Extra: +{combination.extra_capacity}</div>
          )}
        </div>
      </TableCell>

      {/* COLUMNA 4: ZONA */}
      <TableCell>
        {combination.zone_id ? (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getZoneColor(combination.zone_id, zones) }}
            />
            <span className="text-sm">{getZoneName(combination.zone_id, zones)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin zona</span>
        )}
      </TableCell>

      {/* COLUMNA 5: ESTADO (Badge) */}
      <TableCell>
        <Badge variant={combination.is_active ? "default" : "secondary"}>
          {combination.is_active ? "Activa" : "Inactiva"}
        </Badge>
      </TableCell>

      {/* COLUMNA 6: ACCIONES (Switch + Botones) */}
      <TableCell className="text-right">
        <div className="flex justify-end items-center gap-3">
          {/* Switch para activar/desactivar */}
          <div className="flex items-center gap-2">
            <Switch
              checked={combination.is_active}
              onCheckedChange={() => onToggleActive(combination.id, combination.is_active)}
            />
          </div>

          {/* Botones de editar y borrar */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(combination)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente la combinación "{combination.name}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(combination.id)}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
};
