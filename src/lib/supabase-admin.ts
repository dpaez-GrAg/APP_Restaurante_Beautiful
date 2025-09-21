import { createClient } from "@supabase/supabase-js";

// Cliente admin para operaciones de gestión de usuarios
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or Service Role Key for admin operations");
}

// Create admin client with different storage key to avoid conflicts with main client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    // Use different storage key to avoid conflicts with main client
    storageKey: "tu-mesa-ideal-admin-auth",
  },
  // Add admin-specific headers
  global: {
    headers: {
      "X-Client-Info": "tu-mesa-ideal-admin@1.0.0",
    },
  },
});

// Función para crear usuarios usando Admin API
export async function createUserWithAdmin(email: string, password: string, userData: any) {
  try {
    // Crear usuario en auth.users usando Admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: userData,
    });

    if (authError) throw authError;

    // Crear perfil en public.profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.user.id,
        email: authUser.user.email,
        full_name: userData.full_name,
        role: userData.role || "user",
        is_active: true,
      })
      .select()
      .single();

    if (profileError) throw profileError;

    return { success: true, user: authUser.user, profile };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message };
  }
}
