/**
 * Unified reservation types for the reservation system
 */

import { CustomerClassification } from "./customer";
import { TableAssignment } from "./table";

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "arrived" | "completed";

export interface Reservation {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_classification?: CustomerClassification;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  duration_minutes: number;
  email?: string;
  phone?: string;
  special_requests?: string;
  start_at?: string;
  end_at?: string;
  created_at?: string;
  tableAssignments?: TableAssignment[];
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  capacity: number;
  is_normalized?: boolean;
}

export interface Schedule {
  opening_time: string;
  closing_time: string;
  day_of_week?: number;
  is_active?: boolean;
  is_split?: boolean;
}

// Input types for creating reservations
export interface CreateReservationInput {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  date: string;
  time: string;
  guests: number;
  special_requests?: string;
  duration_minutes?: number;
  preferred_zone_id?: string | null;
}

// Input types for updating reservations
export interface UpdateReservationInput {
  date?: string;
  time?: string;
  guests?: number;
  special_requests?: string;
  duration_minutes?: number;
  status?: ReservationStatus;
}

// Result types for reservation operations
export interface ReservationResult {
  success: boolean;
  error?: string;
  reservation_id?: string;
  message?: string;
}

// Display type for grid with calculated positions
export interface ReservationDisplay extends Reservation {
  startSlotIndex: number;
  duration: number; // in slots (15-minute intervals)
}
