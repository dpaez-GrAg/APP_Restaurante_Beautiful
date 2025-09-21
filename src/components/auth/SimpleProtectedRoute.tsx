import React from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SimpleProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const SimpleProtectedRoute: React.FC<SimpleProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, profile, isLocalAdmin } = useAuth();

  // Si es admin local, permitir acceso
  if (isLocalAdmin) {
    return <>{children}</>;
  }

  // Si requiere admin y el usuario tiene rol admin
  if (requireAdmin && profile?.role === "admin") {
    return <>{children}</>;
  }

  // Si no requiere admin y hay usuario
  if (!requireAdmin && user) {
    return <>{children}</>;
  }

  // Redirigir al login si no hay acceso
  if (requireAdmin) {
    window.location.href = "/admin/auth";
    return null;
  }

  window.location.href = "/";
  return null;
};

export default SimpleProtectedRoute;
