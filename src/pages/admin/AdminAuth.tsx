import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AdminAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Verificar credenciales predeterminadas
      if (email === "admin@admin.es" && password === "1234") {
        // Crear o actualizar perfil de admin
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: "admin@admin.es",
          password: "1234"
        });

        if (authError) {
          // Si el usuario no existe, intentar crearlo
          if (authError.message.includes("Invalid login credentials")) {
            const { error: signUpError } = await supabase.auth.signUp({
              email: "admin@admin.es",
              password: "1234",
              options: {
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
              description: "Se ha creado la cuenta de administrador por defecto"
            });
          } else {
            throw authError;
          }
        }

        toast({
          title: "Acceso concedido",
          description: "Bienvenido al panel de administración"
        });

        navigate("/admin");
      } else {
        toast({
          title: "Credenciales incorrectas",
          description: "Email o contraseña incorrectos",
          variant: "destructive"
        });
      }
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
                  placeholder="admin@admin.es"
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
            <p>Contraseña: 1234</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;