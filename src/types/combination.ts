// Types for table combinations management

export interface TableData {
  id: string;
  name: string;
  capacity: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  priority_order: number;
}

export interface CombinationData {
  id: string;
  name: string;
  table_ids: string[];
  total_capacity: number;
  min_capacity: number;
  max_capacity: number;
  extra_capacity: number;
  is_active: boolean;
  zone_id?: string | null;
}

export interface CombinationFormData {
  name: string;
  table_ids: string[];
  min_capacity: number;
  max_capacity: number;
  extra_capacity: number;
  zone_id: string | null;
}

export const getInitialFormData = (): CombinationFormData => ({
  name: "",
  table_ids: [],
  min_capacity: 1,
  max_capacity: 0,
  extra_capacity: 0,
  zone_id: null,
});
