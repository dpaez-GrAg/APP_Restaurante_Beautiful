import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface RestaurantConfig {
  id: string;
  restaurant_name: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
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
        // TODO: Replace with actual Supabase fetch
        const mockConfig: RestaurantConfig = {
          id: "1",
          restaurant_name: "Restaurante Élite",
          hero_title: "Bienvenido a una experiencia gastronómica única",
          hero_subtitle: "Disfruta de los mejores sabores en un ambiente elegante y sofisticado",
          hero_image_url: "src/assets/restaurant-hero.jpg",
          contact_phone: "+34 123 456 789",
          contact_email: "info@restaurante-elite.com",
          contact_address: "Calle Principal 123, Madrid"
        };
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        setConfig(mockConfig);
      } catch (error) {
        console.error("Error loading restaurant config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const updateConfig = (newConfig: RestaurantConfig) => {
    setConfig(newConfig);
    // TODO: Update in Supabase
  };

  return (
    <RestaurantConfigContext.Provider value={{ config, updateConfig, isLoading }}>
      {children}
    </RestaurantConfigContext.Provider>
  );
};