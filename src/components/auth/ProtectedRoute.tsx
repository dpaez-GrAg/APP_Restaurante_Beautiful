import React, { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lock } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: "admin" | "user";
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackPath = "/admin/auth",
}) => {
  const { user, profile, isLoading, hasPermission, isAdmin } = useAuth();
  const location = useLocation();

  // Debug logging - COMENTADO PARA PRODUCCIÓN
  // console.log("ProtectedRoute - isLoading:", isLoading, "isAdmin:", isAdmin, "profile:", profile);

  // Memoize permission check to avoid recalculation
  const hasRequiredPermission = useMemo(() => {
    if (!requiredPermission) return true;
    return hasPermission(requiredPermission);
  }, [requiredPermission, hasPermission]);

  // Memoize role check to avoid recalculation
  const hasRequiredRole = useMemo(() => {
    if (!requiredRole) return true;
    return profile?.role === requiredRole;
  }, [requiredRole, profile?.role]);

  // Use window.location instead of Navigate to avoid React Router loops
  // Para admin local, solo necesitamos profile, no user
  useEffect(() => {
    if (!isLoading && !profile && location.pathname !== fallbackPath) {
      // console.log("ProtectedRoute: No profile found, redirecting to auth");
      window.location.href = fallbackPath;
    }
  }, [isLoading, profile, location.pathname, fallbackPath]);

  // Show loading state
  if (isLoading) {
    // console.log("ProtectedRoute: Loading...");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-restaurant-brown"></div>
            <span className="ml-3 text-restaurant-brown">Verificando permisos...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not logged in (no profile), show loading while redirecting
  if (!profile) {
    // console.log("ProtectedRoute: No profile, showing redirect message");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-pulse">
              <span className="text-restaurant-brown">Redirigiendo al login...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // console.log("ProtectedRoute: Profile found, checking permissions");

  // Check if user account is active
  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-restaurant-brown">Cuenta Desactivada</CardTitle>
            <CardDescription>
              Tu cuenta ha sido desactivada. Contacta con el administrador para más información.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole && !hasRequiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-restaurant-brown">Acceso Restringido</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a esta sección. Se requiere rol: {requiredRole}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Check specific permission
  if (requiredPermission && !hasRequiredPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-restaurant-brown">Permisos Insuficientes</CardTitle>
            <CardDescription>No tienes permisos para realizar esta acción.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // All checks passed, render children
  return <>{children}</>;
};

// Higher-order component for easier usage
export const withPermission = (
  Component: React.ComponentType<any>,
  requiredPermission?: string,
  requiredRole?: "admin" | "user"
) => {
  return (props: any) => (
    <ProtectedRoute requiredPermission={requiredPermission} requiredRole={requiredRole}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

// Hook for checking permissions in components - memoized version
export const usePermissions = () => {
  const { hasPermission, profile, isAdmin, isUser } = useAuth();

  return useMemo(
    () => ({
      hasPermission,
      canViewDashboard: hasPermission("dashboard.view"),
      canViewReservations: hasPermission("reservations.view"),
      canCreateReservations: hasPermission("reservations.create"),
      canEditReservations: hasPermission("reservations.edit"),
      canDeleteReservations: hasPermission("reservations.delete"),
      canViewCustomers: hasPermission("customers.view"),
      canCreateCustomers: hasPermission("customers.create"),
      canEditCustomers: hasPermission("customers.edit"),
      canDeleteCustomers: hasPermission("customers.delete"),
      canViewTables: hasPermission("tables.view"),
      canCreateTables: hasPermission("tables.create"),
      canEditTables: hasPermission("tables.edit"),
      canDeleteTables: hasPermission("tables.delete"),
      canViewLayout: hasPermission("layout.view"),
      canEditLayout: hasPermission("layout.edit"),
      canViewCombinations: hasPermission("combinations.view"),
      canCreateCombinations: hasPermission("combinations.create"),
      canEditCombinations: hasPermission("combinations.edit"),
      canDeleteCombinations: hasPermission("combinations.delete"),
      canViewSchedules: hasPermission("schedules.view"),
      canEditSchedules: hasPermission("schedules.edit"),
      canViewSettings: hasPermission("settings.view"),
      canEditSettings: hasPermission("settings.edit"),
      canViewUsers: hasPermission("users.view"),
      canCreateUsers: hasPermission("users.create"),
      canEditUsers: hasPermission("users.edit"),
      canDeleteUsers: hasPermission("users.delete"),
      // canViewAudit: hasPermission("audit.view"),
      isAdmin,
      isUser,
      userRole: profile?.role,
    }),
    [hasPermission, profile?.role, isAdmin, isUser]
  );
};
