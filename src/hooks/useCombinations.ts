import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { 
  CombinationData, 
  CombinationFormData, 
  TableData, 
  Zone,
  getInitialFormData 
} from "@/types/combination";
import { calculateTotalCapacity } from "@/lib/combinationsUtils";

export const useCombinations = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [combinations, setCombinations] = useState<CombinationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [tablesResult, combinationsResult, zonesResult] = await Promise.all([
        supabase.from('tables').select('*').eq('is_active', true).order('name'),
        supabase.from('table_combinations').select('*').order('name'),
        supabase.rpc('get_zones_ordered')
      ]);
      
      if (tablesResult.error) throw tablesResult.error;
      if (combinationsResult.error) throw combinationsResult.error;
      if (zonesResult.error) throw zonesResult.error;
      
      setTables(tablesResult.data || []);
      setCombinations(combinationsResult.data || []);
      setZones((zonesResult.data as Zone[]) || []);
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
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveCombination = async (
    formData: CombinationFormData,
    editingCombination: CombinationData | null
  ): Promise<boolean> => {
    if (formData.table_ids.length < 2) {
      toast({
        title: "Error",
        description: "Selecciona al menos 2 mesas para crear una combinación",
        variant: "destructive"
      });
      return false;
    }

    try {
      const totalCapacity = calculateTotalCapacity(formData.table_ids, tables);
      
      if (editingCombination) {
        // @ts-ignore - zone_id column exists but types not yet generated
        const { error } = await supabase
          .from('table_combinations')
          .update({
            name: formData.name,
            table_ids: formData.table_ids,
            total_capacity: totalCapacity,
            min_capacity: formData.min_capacity,
            max_capacity: formData.max_capacity,
            extra_capacity: formData.extra_capacity,
            zone_id: formData.zone_id
          })
          .eq('id', editingCombination.id);
        
        if (error) throw error;
        toast({
          title: "Combinación actualizada",
          description: "La combinación se ha actualizado correctamente"
        });
      } else {
        // @ts-ignore - zone_id column exists but types not yet generated
        const { error } = await supabase
          .from('table_combinations')
          .insert([{
            name: formData.name,
            table_ids: formData.table_ids,
            total_capacity: totalCapacity,
            min_capacity: formData.min_capacity,
            max_capacity: formData.max_capacity,
            extra_capacity: formData.extra_capacity,
            zone_id: formData.zone_id
          }]);
        
        if (error) throw error;
        toast({
          title: "Combinación creada",
          description: "La nueva combinación se ha creado correctamente"
        });
      }
      
      await loadData();
      return true;
    } catch (error) {
      console.error('Error saving combination:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la combinación",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCombination = async (id: string): Promise<boolean> => {
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
      return true;
    } catch (error) {
      console.error('Error deleting combination:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la combinación",
        variant: "destructive"
      });
      return false;
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean): Promise<void> => {
    try {
      const { error } = await supabase
        .from('table_combinations')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Combinación ${!currentStatus ? 'activada' : 'desactivada'} correctamente`,
      });

      loadData();
    } catch (error) {
      console.error('Error toggling combination:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de la combinación",
        variant: "destructive"
      });
    }
  };

  return {
    tables,
    zones,
    combinations,
    isLoading,
    saveCombination,
    deleteCombination,
    toggleActive,
    loadData
  };
};
