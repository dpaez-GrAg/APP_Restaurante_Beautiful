export type CustomerClassification = "VIP" | "NEUTRO" | "ALERTA" | "RED_FLAG";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  classification: CustomerClassification;
  classification_notes?: string;
  classification_updated_at?: string;
  classification_updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithStats extends Customer {
  total_reservations: number;
  last_reservation_date?: string;
}

export interface CustomerClassificationHistory {
  id: string;
  customer_id: string;
  old_classification?: CustomerClassification;
  new_classification: CustomerClassification;
  notes?: string;
  changed_by?: string;
  changed_at: string;
}

export interface CustomerDetailReservation {
  id: string;
  date: string;
  time: string;
  guests: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  special_requests?: string;
  created_at: string;
}

export interface CustomerDetail extends CustomerWithStats {
  reservations: CustomerDetailReservation[];
  classification_history: CustomerClassificationHistory[];
}

export const CLASSIFICATION_COLORS: Record<CustomerClassification, string> = {
  VIP: "#10B981", // Verde
  NEUTRO: "#6B7280", // Gris
  ALERTA: "#F59E0B", // Naranja
  RED_FLAG: "#EF4444", // Rojo
};

export const CLASSIFICATION_LABELS: Record<CustomerClassification, string> = {
  VIP: "VIP",
  NEUTRO: "Neutro",
  ALERTA: "Alerta",
  RED_FLAG: "Red Flag",
};

export const CLASSIFICATION_ORDER: Record<CustomerClassification, number> = {
  VIP: 1,
  NEUTRO: 2,
  ALERTA: 3,
  RED_FLAG: 4,
};
