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

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      // console.log("Fetching profile for user:", userId);

      // Fallback inmediato para admin conocido
      if (userId === "12345678-abcd-1234-abcd-123456789012") {
        // console.log("Using hardcoded admin profile for known UUID");
        return {
          id: userId,
          email: "admin@admin.es",
          full_name: "Administrador Principal",
          role: "admin",
          is_active: true,
        };
      }

      // Consulta a la base de datos para otros usuarios
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, is_active")
        .eq("id", userId)
        .single();

      if (error) {
        // console.error("Error fetching profile:", error);
        return null;
      }

      // console.log("Profile fetched successfully:", profileData);
      return profileData as UserProfile;
    } catch (error) {
      // console.error("Error fetching user profile:", error);

      // Fallback final para admin conocido
      if (userId === "12345678-abcd-1234-abcd-123456789012") {
        // console.log("Exception caught, using hardcoded admin profile");
        return {
          id: userId,
          email: "admin@admin.es",
          full_name: "Administrador Principal",
          role: "admin",
          is_active: true,
        };
      }

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
        // Verificar primero si hay admin local
        if (localAdmin) {
          // console.log("Local admin detected, setting up profile");
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

        // Get initial session
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            const userProfile = await fetchUserProfile(initialSession.user.id);
            if (isMounted) {
              setProfile(userProfile);
            }
          }

          setIsLoading(false);
        }

        // Set up auth listener only if not local admin
        if (!localAdmin) {
          authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted || localAdmin) return;

            // console.log("Auth state change:", event, session?.user?.id);

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
              const userProfile = await fetchUserProfile(session.user.id);
              if (isMounted) {
                setProfile(userProfile);
              }
            } else {
              if (isMounted) {
                setProfile(null);
              }
            }
          });
        }
      } catch (error) {
        // console.error("Auth initialization error:", error);
        if (isMounted) {
          setIsLoading(false);
        }
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
    try {
      setLocalAdmin(true);
      localStorage.setItem("local_admin", "true");
    } catch (error) {
      // console.error("Error setting local admin:", error);
    }
  }, []);

  const logoutLocalAdmin = useCallback(() => {
    try {
      setLocalAdmin(false);
      localStorage.removeItem("local_admin");
      setProfile(null);
    } catch (error) {
      // console.error("Error removing local admin:", error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // console.error("Error signing out:", error);
      }
      logoutLocalAdmin();
      setProfile(null);
    } catch (error) {
      // console.error("Sign out error:", error);
    }
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
