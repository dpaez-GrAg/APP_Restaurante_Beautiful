import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AdminAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, loginLocalAdmin } = useAuth();

  // Redirect if already logged in as admin
  useEffect(() => {
    if (user && isAdmin) {
      navigate("/admin");
    }
  }, [user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Local admin fallback without email confirmation
      if (email === "admin@admin.es" && password === "123456") {
        loginLocalAdmin();
        toast({
          title: "Acceso concedido",
          description: "Bienvenido al panel de administración"
        });
        navigate("/admin");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (authError) {
        // If user doesn't exist and trying with default credentials, create it
        if (authError.message.includes("Invalid login credentials") && 
            email === "admin@admin.es" && password === "123456") {
          
          const { error: signUpError } = await supabase.auth.signUp({
            email: "admin@admin.es",
            password: "123456",
            options: {
              emailRedirectTo: `${window.location.origin}/admin`,
              data: {
                role: 'admin'
              }
            }
          });

          if (signUpError) {
            throw signUpError;
          }

          toast({
            title: "Cuenta de administrador creada",
            description: "Se ha creado la cuenta de administrador. Verificando acceso..."
          });

          // Try to sign in again
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email: "admin@admin.es",
            password: "123456"
          });

          if (retryError) {
            throw retryError;
          }
        } else {
          throw authError;
        }
      }

      // Check if user is admin
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profile?.role !== 'admin') {
          await supabase.auth.signOut();
          throw new Error('No tienes permisos de administrador');
        }
      }

      toast({
        title: "Acceso concedido",
        description: "Bienvenido al panel de administración"
      });

      navigate("/admin");
    } catch (error: any) {
      console.error("Error en login:", error);
      toast({
        title: "Error de autenticación",
        description: error.message || "No se pudo iniciar sesión",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-restaurant-cream to-restaurant-gold/20 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-restaurant-gold/20 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-restaurant-brown" />
          </div>
          <CardTitle className="text-2xl font-bold text-restaurant-brown">
            Panel de Administración
          </CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-restaurant-brown">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Introduce tu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-restaurant-brown">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full bg-restaurant-brown hover:bg-restaurant-brown/90"
              disabled={isLoading}
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Credenciales por defecto:</p>
            <p>Email: admin@admin.es</p>
            <p>Contraseña: 123456</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;