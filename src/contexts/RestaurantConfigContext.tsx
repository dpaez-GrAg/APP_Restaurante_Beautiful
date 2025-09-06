import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantConfig {
  id: string;
  restaurant_name: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  logo_url?: string;
  contact_phone: string;
  contact_email: string;
  contact_address: string;
}

interface RestaurantConfigContextType {
  config: RestaurantConfig | null;
  updateConfig: (newConfig: RestaurantConfig) => void;
  isLoading: boolean;
}

const RestaurantConfigContext = createContext<RestaurantConfigContextType | undefined>(undefined);

export const useRestaurantConfig = () => {
  const context = useContext(RestaurantConfigContext);
  if (context === undefined) {
    throw new Error('useRestaurantConfig must be used within a RestaurantConfigProvider');
  }
  return context;
};

interface RestaurantConfigProviderProps {
  children: ReactNode;
}

export const RestaurantConfigProvider = ({ children }: RestaurantConfigProviderProps) => {
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurant_config')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error("Error loading restaurant config:", error);
          return;
        }

        if (data) {
          setConfig(data);
        } else {
          // Si no hay configuración, crear una por defecto
          const defaultConfig = {
            restaurant_name: "Mi Restaurante",
            hero_title: "Bienvenido a una experiencia gastronómica única",
            hero_subtitle: "Disfruta de los mejores sabores en un ambiente elegante y sofisticado",
            hero_image_url: "src/assets/restaurant-hero.jpg",
            contact_phone: "+34 123 456 789",
            contact_email: "info@mi-restaurante.com",
            contact_address: "Calle Principal 123, Madrid"
          };
          
          const { data: newConfig, error: insertError } = await supabase
            .from('restaurant_config')
            .insert(defaultConfig)
            .select()
            .single();

          if (insertError) {
            console.error("Error creating default config:", insertError);
          } else {
            setConfig(newConfig);
          }
        }
      } catch (error) {
        console.error("Error loading restaurant config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const updateConfig = async (newConfig: RestaurantConfig) => {
    try {
      const { error } = await supabase
        .from('restaurant_config')
        .update(newConfig)
        .eq('id', newConfig.id);

      if (error) {
        console.error("Error updating restaurant config:", error);
        throw error;
      }

      setConfig(newConfig);
    } catch (error) {
      console.error("Error updating restaurant config:", error);
      throw error;
    }
  };

  return (
    <RestaurantConfigContext.Provider value={{ config, updateConfig, isLoading }}>
      {children}
    </RestaurantConfigContext.Provider>
  );
};