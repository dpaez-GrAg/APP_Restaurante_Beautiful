import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Upload } from "lucide-react";
import { useRestaurantConfig, RestaurantConfig } from "@/contexts/RestaurantConfigContext";
import { uploadFile } from "@/lib/storageUtils";

const RestaurantSettings = () => {
  const { toast } = useToast();
  const { config: contextConfig, updateConfig: updateContextConfig, isLoading: contextLoading } = useRestaurantConfig();
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize config from context
  useEffect(() => {
    if (contextConfig) {
      setConfig(contextConfig);
    }
  }, [contextConfig]);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await updateContextConfig(config);
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han aplicado correctamente",
      });
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleHeroImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && config) {
      try {
        // Validaciones del archivo
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          toast({
            title: "Archivo demasiado grande",
            description: "La imagen debe ser menor a 5MB",
            variant: "destructive",
          });
          return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Tipo de archivo no válido",
            description: "Solo se permiten archivos JPG, PNG, WebP y GIF",
            variant: "destructive",
          });
          return;
        }

        // Mostrar toast de progreso
        toast({
          title: "Subiendo imagen...",
          description: "Por favor espera mientras se sube la imagen de fondo",
        });

        const filePath = `hero/${Date.now()}-${file.name}`;
        const imageUrl = await uploadFile("restaurant-images", filePath, file);

        setConfig({
          ...config,
          hero_image_url: imageUrl,
        });

        toast({
          title: "Imagen subida exitosamente",
          description: "La imagen de fondo se ha subido correctamente",
        });
      } catch (error: any) {
        console.error("Error uploading hero image:", error);

        let errorMessage = "No se pudo subir la imagen";

        if (error.message?.includes("bucket")) {
          errorMessage = "Error de configuración del storage. Contacta al administrador.";
        } else if (error.message?.includes("permission") || error.message?.includes("policy")) {
          errorMessage = "No tienes permisos para subir imágenes. Verifica tu autenticación.";
        } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
          errorMessage = "Error de conexión. Verifica tu conexión a internet.";
        } else if (error.message?.includes("size")) {
          errorMessage = "El archivo es demasiado grande.";
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }

        toast({
          title: "Error al subir imagen",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && config) {
      try {
        // Validaciones del archivo
        const maxSize = 2 * 1024 * 1024; // 2MB para logos
        if (file.size > maxSize) {
          toast({
            title: "Archivo demasiado grande",
            description: "El logo debe ser menor a 2MB",
            variant: "destructive",
          });
          return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: "Tipo de archivo no válido",
            description: "Solo se permiten archivos JPG, PNG, WebP y GIF",
            variant: "destructive",
          });
          return;
        }

        // Mostrar toast de progreso
        toast({
          title: "Subiendo logo...",
          description: "Por favor espera mientras se sube el logo",
        });

        const filePath = `logos/${Date.now()}-${file.name}`;
        const imageUrl = await uploadFile("restaurant-images", filePath, file);

        setConfig({
          ...config,
          logo_url: imageUrl,
        });

        toast({
          title: "Logo subido exitosamente",
          description: "El logo se ha subido correctamente",
        });
      } catch (error: any) {
        console.error("Error uploading logo:", error);

        let errorMessage = "No se pudo subir el logo";

        if (error.message?.includes("bucket")) {
          errorMessage = "Error de configuración del storage. Contacta al administrador.";
        } else if (error.message?.includes("permission") || error.message?.includes("policy")) {
          errorMessage = "No tienes permisos para subir imágenes. Verifica tu autenticación.";
        } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
          errorMessage = "Error de conexión. Verifica tu conexión a internet.";
        } else if (error.message?.includes("size")) {
          errorMessage = "El archivo es demasiado grande.";
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }

        toast({
          title: "Error al subir logo",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveHeroImage = () => {
    if (config) {
      setConfig({
        ...config,
        hero_image_url: "",
      });
      toast({
        title: "Imagen eliminada",
        description: "La imagen de fondo ha sido eliminada",
      });
    }
  };

  const handleRemoveLogo = () => {
    if (config) {
      setConfig({
        ...config,
        logo_url: "",
      });
      toast({
        title: "Logo eliminado",
        description: "El logo ha sido eliminado",
      });
    }
  };

  if (contextLoading || !config) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Settings className="w-8 h-8 animate-spin mx-auto mb-4 text-restaurant-gold" />
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-restaurant-brown">Configuración</h1>
        <p className="text-muted-foreground">Personaliza la información y apariencia de tu restaurante</p>
      </div>

      <div className="grid gap-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
            <CardDescription>Configura el nombre y datos básicos de tu restaurante</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="restaurant-name">Nombre del Restaurante</Label>
              <Input
                id="restaurant-name"
                value={config.restaurant_name}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    restaurant_name: e.target.value,
                  })
                }
                placeholder="Nombre de tu restaurante"
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuración del Hero */}
        <Card>
          <CardHeader>
            <CardTitle>Configura tu web</CardTitle>
            <CardDescription>Personaliza el título, subtítulo e imagen de la sección principal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="hero-title">Título Principal</Label>
              <Input
                id="hero-title"
                value={config.hero_title}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    hero_title: e.target.value,
                  })
                }
                placeholder="Título principal de tu restaurante"
              />
            </div>

            <div>
              <Label htmlFor="hero-subtitle">Subtítulo</Label>
              <Textarea
                id="hero-subtitle"
                value={config.hero_subtitle}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    hero_subtitle: e.target.value,
                  })
                }
                placeholder="Descripción atractiva de tu restaurante"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="hero-image">Imagen de Fondo</Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="hero-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleHeroImageUpload}
                  className="flex-1"
                  style={{ display: "none" }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("hero-image")?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Imagen de Fondo
                </Button>
                {config.hero_image_url && (
                  <Button variant="destructive" size="sm" onClick={handleRemoveHeroImage} className="px-3">
                    Eliminar
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Formatos: JPG, PNG, WebP, GIF. Máximo 5MB.</p>
              {config.hero_image_url && (
                <div className="mt-2">
                  <img
                    src={config.hero_image_url}
                    alt="Vista previa"
                    className="w-32 h-20 object-cover rounded border"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="logo-image">Logo del Restaurante</Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="logo-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleLogoUpload}
                  className="flex-1"
                  style={{ display: "none" }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("logo-image")?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Logo
                </Button>
                {config.logo_url && (
                  <Button variant="destructive" size="sm" onClick={handleRemoveLogo} className="px-3">
                    Eliminar
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Formatos: JPG, PNG, WebP, GIF. Máximo 2MB.</p>
              {config.logo_url && (
                <div className="mt-2">
                  <img src={config.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded border" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Información de Contacto */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Contacto</CardTitle>
            <CardDescription>Datos de contacto que aparecerán en el sitio web</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input
                id="contact-phone"
                value={config.contact_phone}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    contact_phone: e.target.value,
                  })
                }
                placeholder="+34 123 456 789"
              />
            </div>

            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={config.contact_email}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    contact_email: e.target.value,
                  })
                }
                placeholder="info@turestaurante.com"
              />
            </div>

            <div>
              <Label htmlFor="contact-address">Dirección</Label>
              <Textarea
                id="contact-address"
                value={config.contact_address}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    contact_address: e.target.value,
                  })
                }
                placeholder="Dirección completa de tu restaurante"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Botón Guardar */}
        <Card>
          <CardContent className="pt-6">
            <Button onClick={handleSave} disabled={isSaving} size="lg" className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default RestaurantSettings;
