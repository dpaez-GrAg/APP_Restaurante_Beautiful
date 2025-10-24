/**
 * Unified table types for the reservation system
 */

export interface Table {
  id: string;
  name: string;
  capacity: number;
  extra_capacity?: number;
  zone_id?: string | null;
  zone_name?: string | null;
  zone_color?: string | null;
  is_active?: boolean;
}

export interface TableWithAvailability {
  table_id: string;
  table_name: string;
  capacity: number;
  extra_capacity: number;
  total_capacity: number;
  zone_id: string | null;
  zone_name: string | null;
  zone_color: string | null;
  is_available: boolean;
}

export interface TableAssignment {
  table_id: string;
  table_name: string;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  priority_order: number;
}
