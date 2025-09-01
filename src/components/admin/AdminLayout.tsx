import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminGuard from "@/components/AdminGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const AdminLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente"
      });
      navigate("/");
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "No se pudo cerrar la sesión",
        variant: "destructive"
      });
    }
  };

  const goToHome = () => {
    navigate("/");
  };

  return (
    <AdminGuard>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          {/* Header fijo */}
          <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-background border-b border-border shadow-sm">
            <div className="flex items-center space-x-4">
              <SidebarTrigger className="text-restaurant-brown" />
              <h1 className="text-lg font-semibold text-restaurant-brown">
                Panel de Administración
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToHome}
                className="text-muted-foreground hover:text-restaurant-brown"
              >
                <Home className="w-4 h-4 mr-1" />
                Ver Sitio
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Salir
              </Button>
            </div>
          </header>

          <div className="flex w-full pt-14">
            <AdminSidebar />
            
            <main className="flex-1 p-6 bg-gradient-subtle min-h-screen">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminGuard>
  );
};

export default AdminLayout;