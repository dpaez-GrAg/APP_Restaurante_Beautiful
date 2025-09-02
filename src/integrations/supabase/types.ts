export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservation_table_assignments: {
        Row: {
          created_at: string
          id: string
          reservation_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reservation_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reservation_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_table_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_table_assignments_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          customer_id: string
          date: string
          duration_minutes: number | null
          end_at: string | null
          guests: number
          id: string
          special_requests: string | null
          start_at: string | null
          status: string | null
          time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          date: string
          duration_minutes?: number | null
          end_at?: string | null
          guests: number
          id?: string
          special_requests?: string | null
          start_at?: string | null
          status?: string | null
          time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          date?: string
          duration_minutes?: number | null
          end_at?: string | null
          guests?: number
          id?: string
          special_requests?: string | null
          start_at?: string | null
          status?: string | null
          time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_config: {
        Row: {
          city: string | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          hero_image_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_active: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          postcode: string | null
          restaurant_name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          postcode?: string | null
          restaurant_name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          postcode?: string | null
          restaurant_name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_schedules: {
        Row: {
          closing_time: string
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          opening_time: string
          updated_at: string
        }
        Insert: {
          closing_time: string
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          opening_time: string
          updated_at?: string
        }
        Update: {
          closing_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          opening_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      special_closed_days: {
        Row: {
          created_at: string
          date: string
          id: string
          is_range: boolean
          range_end: string | null
          range_start: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_range?: boolean
          range_end?: string | null
          range_start?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_range?: boolean
          range_end?: string | null
          range_start?: string | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      special_schedule_days: {
        Row: {
          closing_time: string
          created_at: string
          date: string
          id: string
          is_active: boolean
          opening_time: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          closing_time: string
          created_at?: string
          date: string
          id?: string
          is_active?: boolean
          opening_time: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          closing_time?: string
          created_at?: string
          date?: string
          id?: string
          is_active?: boolean
          opening_time?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      table_combinations: {
        Row: {
          created_at: string
          extra_capacity: number | null
          id: string
          is_active: boolean
          max_capacity: number | null
          min_capacity: number | null
          name: string
          table_ids: string[]
          total_capacity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_capacity?: number | null
          id?: string
          is_active?: boolean
          max_capacity?: number | null
          min_capacity?: number | null
          name: string
          table_ids: string[]
          total_capacity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_capacity?: number | null
          id?: string
          is_active?: boolean
          max_capacity?: number | null
          min_capacity?: number | null
          name?: string
          table_ids?: string[]
          total_capacity?: number
          updated_at?: string
        }
        Relationships: []
      }
      tables: {
        Row: {
          capacity: number
          created_at: string
          extra_capacity: number | null
          id: string
          is_active: boolean
          max_capacity: number | null
          min_capacity: number | null
          name: string
          position_x: number | null
          position_y: number | null
          shape: string | null
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          extra_capacity?: number | null
          id?: string
          is_active?: boolean
          max_capacity?: number | null
          min_capacity?: number | null
          name: string
          position_x?: number | null
          position_y?: number | null
          shape?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          extra_capacity?: number | null
          id?: string
          is_active?: boolean
          max_capacity?: number | null
          min_capacity?: number | null
          name?: string
          position_x?: number | null
          position_y?: number | null
          shape?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_slots: {
        Row: {
          created_at: string
          id: string
          max_capacity: number
          time: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_capacity?: number
          time: string
        }
        Update: {
          created_at?: string
          id?: string
          max_capacity?: number
          time?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_reservation: {
        Args: {
          p_customer_email: string
          p_customer_name: string
          p_customer_phone?: string
          p_date: string
          p_duration_minutes?: number
          p_guests: number
          p_special_requests?: string
          p_table_ids?: string[]
          p_time: string
        }
        Returns: Json
      }
      create_reservation_with_assignment: {
        Args: {
          p_customer_id: string
          p_date: string
          p_duration_minutes?: number
          p_guests: number
          p_special_requests?: string
          p_time: string
        }
        Returns: Json
      }
      create_reservation_with_specific_tables: {
        Args: {
          p_customer_id: string
          p_date: string
          p_duration_minutes?: number
          p_guests: number
          p_special_requests?: string
          p_table_ids?: string[]
          p_time: string
        }
        Returns: Json
      }
      get_available_time_slots: {
        Args: { p_date: string; p_duration_minutes?: number; p_guests: number }
        Returns: {
          capacity: number
          id: string
          slot_time: string
        }[]
      }
      move_reservation_with_validation: {
        Args: {
          p_duration_minutes?: number
          p_new_date: string
          p_new_table_ids?: string[]
          p_new_time: string
          p_reservation_id: string
        }
        Returns: Json
      }
      update_reservation_details: {
        Args: {
          p_guests?: number
          p_reservation_id: string
          p_special_requests?: string
          p_status?: string
        }
        Returns: Json
      }
      update_reservation_guests_with_reassignment: {
        Args: { p_new_guests: number; p_reservation_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
