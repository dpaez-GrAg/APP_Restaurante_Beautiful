import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface UseAdminAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  shouldRedirect: boolean;
}

export const useAdminAuth = (): UseAdminAuthReturn => {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const hasChecked = useRef(false);
  const redirectTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Limpiar timeout anterior
    if (redirectTimeout.current) {
      clearTimeout(redirectTimeout.current);
    }

    // Solo verificar una vez que termine de cargar
    if (!isLoading && !hasChecked.current) {
      hasChecked.current = true;

      if (!isAdmin && location.pathname.startsWith("/admin") && location.pathname !== "/admin/auth") {
        setShouldRedirect(true);

        // Usar timeout para evitar loops
        redirectTimeout.current = setTimeout(() => {
          // console.log("useAdminAuth: Redirecting to /admin/auth");
          navigate("/admin/auth", { replace: true });
          setShouldRedirect(false);
        }, 200);
      }
    }

    // Reset cuando el usuario se convierte en admin
    if (isAdmin && hasChecked.current) {
      setShouldRedirect(false);
    }

    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current);
      }
    };
  }, [isAdmin, isLoading, location.pathname, navigate]);

  // Reset check when location changes to auth
  useEffect(() => {
    if (location.pathname === "/admin/auth") {
      hasChecked.current = false;
      setShouldRedirect(false);
    }
  }, [location.pathname]);

  return {
    isAuthenticated: isAdmin,
    isLoading,
    shouldRedirect,
  };
};
