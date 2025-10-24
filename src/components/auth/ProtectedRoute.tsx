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
  const { profile, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  // Verificaciones memoizadas
  const hasRequiredPermission = useMemo(() => {
    if (!requiredPermission) return true;
    return hasPermission(requiredPermission);
  }, [requiredPermission, hasPermission]);

  const hasRequiredRole = useMemo(() => {
    if (!requiredRole) return true;
    return profile?.role === requiredRole;
  }, [requiredRole, profile?.role]);

  // Redirección si no hay perfil
  useEffect(() => {
    if (!isLoading && !profile && location.pathname !== fallbackPath) {
      window.location.href = fallbackPath;
    }
  }, [isLoading, profile, location.pathname, fallbackPath]);

  // Estados de carga y redirección
  if (isLoading || !profile) {
    const message = isLoading ? "Verificando permisos..." : "Redirigiendo...";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-restaurant-brown mr-3"></div>
            <span className="text-restaurant-brown">{message}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificaciones de acceso
  if (!profile.is_active) {
    return renderAccessDenied(
      <AlertTriangle className="w-8 h-8 text-red-600" />,
      "Cuenta Desactivada",
      "Tu cuenta ha sido desactivada. Contacta con el administrador.",
      "bg-red-100"
    );
  }

  if (requiredRole && !hasRequiredRole) {
    return renderAccessDenied(
      <Lock className="w-8 h-8 text-orange-600" />,
      "Acceso Restringido",
      `Se requiere rol: ${requiredRole}`,
      "bg-orange-100"
    );
  }

  if (requiredPermission && !hasRequiredPermission) {
    return renderAccessDenied(
      <Lock className="w-8 h-8 text-orange-600" />,
      "Permisos Insuficientes",
      "No tienes permisos para acceder a esta sección.",
      "bg-orange-100"
    );
  }

  return <>{children}</>;
};

// Helper para renderizar mensajes de acceso denegado
const renderAccessDenied = (
  icon: React.ReactNode,
  title: string,
  description: string,
  iconBgColor: string
) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20 p-4">
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center space-y-4">
        <div className={`w-16 h-16 mx-auto ${iconBgColor} rounded-full flex items-center justify-center`}>
          {icon}
        </div>
        <CardTitle className="text-2xl font-bold text-restaurant-brown">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  </div>
);

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
