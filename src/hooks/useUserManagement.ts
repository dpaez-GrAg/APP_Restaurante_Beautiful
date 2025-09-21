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
      console.log("🚀 Intentando crear usuario con Admin SDK:", userData.email);

      // Opción 1: Usar Admin SDK (si tienes Service Role Key)
      try {
        const result = await createUserWithAdmin(userData.email, userData.password, {
          full_name: userData.full_name,
          role: userData.role,
        });

        if (result.success) {
          console.log("✅ Usuario creado exitosamente con Admin SDK");
          toast({
            title: "Usuario creado",
            description: `${userData.full_name} ha sido creado exitosamente`,
          });
          return { success: true, data: result };
        } else {
          console.log("❌ Admin SDK falló:", result.error);
          throw new Error("Admin SDK failed: " + result.error);
        }
      } catch (adminError) {
        console.warn("⚠️ Admin SDK failed, trying RPC function:", adminError);

        // Opción 2: Fallback a función RPC
        console.log("🔄 Intentando con función RPC...");

        const { data, error: rpcError } = await supabase.rpc("admin_create_user", {
          p_email: userData.email,
          p_password: userData.password,
          p_full_name: userData.full_name,
          p_role: userData.role,
        });

        if (rpcError) {
          console.error("❌ RPC Error:", rpcError);
          throw rpcError;
        }

        const result = data as { success: boolean; error?: string };
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
      }
    } catch (error) {
      console.error("💥 Error final:", error);

      // Mensaje de error más específico
      let errorMessage = "No se pudo crear el usuario";
      if (error.message?.includes("duplicate key")) {
        errorMessage = "Este email ya está registrado. Usa un email diferente.";
      } else if (error.message?.includes("profiles_pkey")) {
        errorMessage = "Error de duplicado. Intenta con un email diferente.";
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
      const { data, error } = await supabase.rpc("admin_get_users");
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { success: false, error: error.message };
    }
  };

  const updateUser = async (userId: string, userData: UpdateUserData) => {
    try {
      const { data, error } = await supabase.rpc("admin_update_user", {
        p_user_id: userId,
        p_email: null, // No cambiamos email por ahora
        p_full_name: userData.full_name,
        p_role: userData.role,
        p_is_active: userData.is_active,
      });

      if (error) throw error;

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
        const { data, error: rpcError } = await supabase.rpc("admin_change_password", {
          p_user_id: userId,
          p_new_password: newPassword,
        });

        if (rpcError) throw rpcError;

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
