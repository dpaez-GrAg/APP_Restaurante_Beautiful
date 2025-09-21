import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Provide them at build time.");
}

// Singleton pattern to ensure only one instance is created
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const createSupabaseClient = () => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Use a unique storage key to avoid conflicts
      storageKey: "tu-mesa-ideal-auth",
      // Detect session from URL on mount
      detectSessionInUrl: true,
      // Disable debug mode to reduce console noise
      debug: false,
    },
    // Add global configuration
    global: {
      headers: {
        "X-Client-Info": "tu-mesa-ideal@1.0.0",
      },
    },
    // Disable realtime to reduce connections
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  });

  return supabaseInstance;
};

// Create a single instance of the Supabase client to avoid multiple GoTrueClient instances
export const supabase = createSupabaseClient();

// Backwards compatibility alias if legacy code expects `G`
export const G = supabase;
export default supabase;
