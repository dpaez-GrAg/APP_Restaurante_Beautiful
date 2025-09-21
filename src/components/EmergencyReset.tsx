import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, Trash2 } from "lucide-react";

interface EmergencyResetProps {
  error?: string;
  onReset?: () => void;
}

const EmergencyReset: React.FC<EmergencyResetProps> = ({ error, onReset }) => {
  const handleHardReset = () => {
    try {
      // Limpiar localStorage
      localStorage.clear();

      // Limpiar sessionStorage
      sessionStorage.clear();

      // Limpiar cookies si es posible
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });

      // Forzar recarga completa
      window.location.href = "/";
    } catch (error) {
      console.error("Error during hard reset:", error);
      window.location.reload();
    }
  };

  const handleSoftReset = () => {
    try {
      if (onReset) {
        onReset();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("Error during soft reset:", error);
      window.location.reload();
    }
  };

  const goHome = () => {
    try {
      window.location.href = "/";
    } catch (error) {
      console.error("Error navigating home:", error);
      window.location.reload();
    }
  };

  const clearAdminState = () => {
    try {
      localStorage.removeItem("local_admin");
      sessionStorage.clear();
      window.location.href = "/admin/auth";
    } catch (error) {
      console.error("Error clearing admin state:", error);
      window.location.reload();
    }
  };

  const isNavigationError = error?.includes("history.replaceState") || error?.includes("100 times per 10 seconds");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-restaurant-brown">
            {isNavigationError ? "Error de Navegación" : "Error del Sistema"}
          </CardTitle>
          <CardDescription>
            {isNavigationError ? (
              <>
                Se ha detectado un loop infinito de navegación.
                <strong className="block mt-2 text-red-600">Usa "Limpiar Estado Admin" para solucionarlo.</strong>
              </>
            ) : (
              "Ha ocurrido un error en el panel de administración."
            )}
            {error && (
              <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 max-h-20 overflow-y-auto">{error}</div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isNavigationError && (
            <Button onClick={clearAdminState} className="w-full" variant="default">
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar Estado Admin
            </Button>
          )}

          <Button onClick={handleSoftReset} className="w-full" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar Página
          </Button>

          <Button onClick={goHome} className="w-full" variant="outline">
            <Home className="w-4 h-4 mr-2" />
            Ir al Inicio
          </Button>

          <Button onClick={handleHardReset} className="w-full" variant="destructive">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Reset Completo
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {isNavigationError
              ? 'Si el problema persiste, usa "Reset Completo" para limpiar todo el estado.'
              : "Si el problema persiste, contacta al administrador del sistema."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmergencyReset;
