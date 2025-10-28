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
      // Usar fetch directo
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const [tablesResponse, combinationsResponse, zonesResponse] = await Promise.all([
        fetch(`${url}/rest/v1/tables?select=*&is_active=eq.true&order=name`, {
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        }),
        fetch(`${url}/rest/v1/table_combinations?select=*&order=name`, {
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        }),
        fetch(`${url}/rest/v1/rpc/get_zones_ordered`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({})
        })
      ]);
      
      if (!tablesResponse.ok || !combinationsResponse.ok || !zonesResponse.ok) {
        throw new Error('Error loading data');
      }
      
      const [tablesData, combinationsData, zonesData] = await Promise.all([
        tablesResponse.json(),
        combinationsResponse.json(),
        zonesResponse.json()
      ]);
      
      setTables(tablesData || []);
      setCombinations(combinationsData || []);
      setZones((zonesData as Zone[]) || []);
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
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${url}/rest/v1/table_combinations?id=eq.${editingCombination.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: formData.name,
            table_ids: formData.table_ids,
            total_capacity: totalCapacity,
            min_capacity: formData.min_capacity,
            max_capacity: formData.max_capacity,
            extra_capacity: formData.extra_capacity,
            zone_id: formData.zone_id
          })
        });
        
        if (!response.ok) throw new Error('Error updating combination');
        toast({
          title: "Combinación actualizada",
          description: "La combinación se ha actualizado correctamente"
        });
      } else {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${url}/rest/v1/table_combinations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: formData.name,
            table_ids: formData.table_ids,
            total_capacity: totalCapacity,
            min_capacity: formData.min_capacity,
            max_capacity: formData.max_capacity,
            extra_capacity: formData.extra_capacity,
            zone_id: formData.zone_id
          })
        });
        
        if (!response.ok) throw new Error('Error creating combination');
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
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${url}/rest/v1/table_combinations?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      
      if (!response.ok) throw new Error('Error deleting combination');
      
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
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${url}/rest/v1/table_combinations?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!response.ok) throw new Error('Error toggling combination');

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
