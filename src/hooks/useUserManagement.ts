import { useState } from "react";
import { createUserWithAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "user";
}

export interface UpdateUserData {
  full_name: string;
  role: "admin" | "user";
  is_active: boolean;
}

export function useUserManagement() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const createUser = async (userData: CreateUserData) => {
    setIsLoading(true);
    try {
      console.log("🚀 Intentando crear usuario:", userData.email);

      // ✅ VERIFICACIÓN 1: Comprobar en profiles
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", userData.email)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("❌ Error verificando email:", checkError);
        throw checkError;
      }

      if (existingProfile) {
        console.log("❌ Email ya existe en profiles");
        toast({
          title: "Error",
          description: "Email ya existe",
          variant: "destructive",
        });
        return { success: false, error: "Email ya existe" };
      }

      console.log("✅ Email disponible, usando RPC directamente...");

      // Usar fetch directo
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${url}/rest/v1/rpc/admin_create_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          p_email: userData.email,
          p_password: userData.password,
          p_full_name: userData.full_name,
          p_role: userData.role,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ RPC Error:", errorText);
        throw new Error(errorText);
      }
      
      const data = await response.json();

      const result = data as { success: boolean; error?: string; user_id?: string };
      console.log("📊 RPC Result:", result);

      if (result.success) {
        console.log("✅ Usuario creado exitosamente con RPC");
        toast({
          title: "Usuario creado",
          description: `${userData.full_name} ha sido creado exitosamente`,
        });
        return { success: true, data: result };
      } else {
        console.error("❌ RPC returned error:", result.error);
        throw new Error(result.error || "Error desconocido");
      }
    } catch (error: any) {
      console.error("💥 Error final:", error);

      let errorMessage = "No se pudo crear el usuario";
      if (error.message?.includes("Email ya existe")) {
        errorMessage = "Email ya existe";
      } else if (error.message?.includes("duplicate key")) {
        errorMessage = "Email ya existe";
      } else if (error.message?.includes("profiles_pkey")) {
        errorMessage = "Email ya existe";
      } else if (error.message?.includes("already exists")) {
        errorMessage = "Email ya existe";
      } else {
        errorMessage = error.message || "Error desconocido";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const getUsers = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${url}/rest/v1/rpc/admin_get_users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) throw new Error('Error fetching users');
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { success: false, error: error.message };
    }
  };

  const updateUser = async (userId: string, userData: UpdateUserData) => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${url}/rest/v1/rpc/admin_update_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_email: null,
          p_full_name: userData.full_name,
          p_role: userData.role,
          p_is_active: userData.is_active,
        }),
      });

      if (!response.ok) throw new Error('Error updating user');
      const data = await response.json();

      const result = data as { success: boolean; error?: string };

      if (result.success) {
        return { success: true, data: result };
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      return { success: false, error: error.message };
    }
  };

  const changePassword = async (userId: string, newPassword: string) => {
    try {
      // Intentar usar Admin SDK primero
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      // Fallback a RPC function
      try {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${url}/rest/v1/rpc/admin_change_password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            p_user_id: userId,
            p_new_password: newPassword,
          }),
        });

        if (!response.ok) throw new Error('Error changing password');
        const data = await response.json();

        const result = data as { success: boolean; error?: string };

        if (result.success) {
          return { success: true, data: result };
        } else {
          throw new Error(result.error || "Error desconocido");
        }
      } catch (rpcError) {
        console.error("Error changing password:", rpcError);
        return { success: false, error: rpcError.message };
      }
    }
  };

  return {
    createUser,
    getUsers,
    updateUser,
    changePassword,
    isLoading,
  };
}
