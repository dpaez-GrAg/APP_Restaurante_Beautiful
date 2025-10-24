// Utility functions for combinations management
import { TableData, Zone } from "@/types/combination";

export const calculateTotalCapacity = (tableIds: string[], tables: TableData[]): number => {
  return tables
    .filter(table => tableIds.includes(table.id))
    .reduce((total, table) => total + table.capacity, 0);
};

export const getTableNames = (tableIds: string[], tables: TableData[]): string => {
  return tables
    .filter(table => tableIds.includes(table.id))
    .map(table => table.name)
    .join(', ');
};

export const getZoneName = (zoneId: string | null | undefined, zones: Zone[]): string => {
  if (!zoneId) return 'Sin zona';
  const zone = zones.find(z => z.id === zoneId);
  return zone?.name || 'Sin zona';
};

export const getZoneColor = (zoneId: string | null | undefined, zones: Zone[]): string => {
  if (!zoneId) return '#6B7280';
  const zone = zones.find(z => z.id === zoneId);
  return zone?.color || '#6B7280';
};
