import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "user";

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isUser: boolean;
  signOut: () => Promise<void>;
  loginLocalAdmin: () => void;
  logoutLocalAdmin: () => void;
  hasPermission: (permission: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  isUser: false,
  signOut: async () => {},
  loginLocalAdmin: () => {},
  logoutLocalAdmin: () => {},
  hasPermission: () => false,
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localAdmin, setLocalAdmin] = useState<boolean>(() => {
    try {
      return localStorage.getItem("local_admin") === "true";
    } catch {
      return false;
    }
  });

  const ADMIN_PROFILE_FALLBACK: UserProfile = {
    id: "12345678-abcd-1234-abcd-123456789012",
    email: "admin@admin.es",
    full_name: "Administrador Principal",
    role: "admin",
    is_active: true,
  };

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    // Fallback para admin conocido
    if (userId === ADMIN_PROFILE_FALLBACK.id) {
      return ADMIN_PROFILE_FALLBACK;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, is_active")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data as UserProfile;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const userProfile = await fetchUserProfile(user.id);
      setProfile(userProfile);
    }
  }, [user?.id, fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initAuth = async () => {
      try {
        // Admin local
        if (localAdmin) {
          if (isMounted) {
            setProfile({
              id: "local-admin",
              email: "admin@admin.es",
              full_name: "Local Admin",
              role: "admin",
              is_active: true,
            });
            setIsLoading(false);
          }
          return;
        }

        // Obtener sesión con timeout
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 10000)
          )
        ]).catch(() => ({ data: { session: null } }));

        const initialSession = data?.session || null;

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            const userProfile = await fetchUserProfile(initialSession.user.id);
            if (isMounted) setProfile(userProfile);
          }

          setIsLoading(false);
        }

        // Listener de cambios de autenticación
        if (!localAdmin) {
          authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted || localAdmin) return;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
              const userProfile = await fetchUserProfile(session.user.id);
              if (isMounted) setProfile(userProfile);
            } else {
              if (isMounted) setProfile(null);
            }
          });
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      if (authSubscription?.data?.subscription) {
        authSubscription.data.subscription.unsubscribe();
      }
    };
  }, [localAdmin, fetchUserProfile]);

  const loginLocalAdmin = useCallback(() => {
    setLocalAdmin(true);
    localStorage.setItem("local_admin", "true");
    setProfile({
      id: "local-admin",
      email: "admin@admin.es",
      full_name: "Local Admin",
      role: "admin",
      is_active: true,
    });
  }, []);

  const logoutLocalAdmin = useCallback(() => {
    setLocalAdmin(false);
    localStorage.removeItem("local_admin");
    setProfile(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(console.error);
    logoutLocalAdmin();
    setProfile(null);
  }, [logoutLocalAdmin]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (localAdmin) return true;
      if (!profile || !profile.is_active) return false;

      const permissions: Record<UserRole, string[]> = {
        admin: [
          "dashboard.view",
          "reservations.view",
          "reservations.create",
          "reservations.edit",
          "reservations.delete",
          "customers.view",
          "customers.create",
          "customers.edit",
          "customers.delete",
          "tables.view",
          "tables.create",
          "tables.edit",
          "tables.delete",
          "zones.view",
          "zones.create",
          "zones.edit",
          "zones.delete",
          "layout.view",
          "layout.edit",
          "combinations.view",
          "combinations.create",
          "combinations.edit",
          "combinations.delete",
          "schedules.view",
          "schedules.edit",
          "settings.view",
          "settings.edit",
          "users.view",
          "users.create",
          "users.edit",
          "users.delete",
          // "audit.view",
        ],
        user: [
          "dashboard.view",
          "reservations.view",
          "reservations.create",
          "reservations.edit",
          "customers.view",
          "customers.create",
          "customers.edit",
        ],
      };

      return permissions[profile.role]?.includes(permission) || false;
    },
    [localAdmin, profile]
  );

  const isAdmin = useMemo(() => {
    return localAdmin || (profile?.role === "admin" && profile?.is_active);
  }, [localAdmin, profile?.role, profile?.is_active]);

  const isUser = useMemo(() => {
    return profile?.role === "user" && profile?.is_active;
  }, [profile?.role, profile?.is_active]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      isLoading,
      isAdmin,
      isUser,
      signOut,
      loginLocalAdmin,
      logoutLocalAdmin,
      hasPermission,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      isLoading,
      isAdmin,
      isUser,
      signOut,
      loginLocalAdmin,
      logoutLocalAdmin,
      hasPermission,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
