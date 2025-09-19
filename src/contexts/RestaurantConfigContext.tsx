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
  isInitialLoad: boolean;
}

const RestaurantConfigContext = createContext<RestaurantConfigContextType | undefined>(undefined);

export const useRestaurantConfig = () => {
  const context = useContext(RestaurantConfigContext);
  if (context === undefined) {
    throw new Error("useRestaurantConfig must be used within a RestaurantConfigProvider");
  }
  return context;
};

// Configuración por defecto optimizada
const DEFAULT_CONFIG = {
  id: "default",
  restaurant_name: "Mi Restaurante",
  hero_title: "Bienvenido a una experiencia gastronómica única",
  hero_subtitle: "Disfruta de los mejores sabores en un ambiente elegante y sofisticado",
  hero_image_url: "/src/assets/restaurant-hero.jpg",
  logo_url: "",
  contact_phone: "+34 123 456 789",
  contact_email: "info@mi-restaurante.com",
  contact_address: "Calle Principal 123, Madrid",
};

// Clave para localStorage
const CACHE_KEY = "restaurant_config_cache";
const CACHE_TIMESTAMP_KEY = "restaurant_config_timestamp";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface RestaurantConfigProviderProps {
  children: ReactNode;
}

export const RestaurantConfigProvider = ({ children }: RestaurantConfigProviderProps) => {
  const [config, setConfig] = useState<RestaurantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Función para cargar desde cache
  const loadFromCache = (): RestaurantConfig | null => {
    try {
      const cachedConfig = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cachedConfig && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp);
        const now = Date.now();

        // Si el cache es válido (menos de 5 minutos)
        if (now - timestamp < CACHE_DURATION) {
          return JSON.parse(cachedConfig);
        }
      }
    } catch (error) {
      console.error("Error loading from cache:", error);
    }
    return null;
  };

  // Función para guardar en cache
  const saveToCache = (configData: RestaurantConfig) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(configData));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error("Error saving to cache:", error);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 1. Intentar cargar desde cache primero
        const cachedConfig = loadFromCache();
        if (cachedConfig) {
          setConfig(cachedConfig);
          setIsLoading(false);
          setIsInitialLoad(false);

          // Cargar en background para actualizar si hay cambios
          loadFromDatabase(false);
          return;
        }

        // 2. Si no hay cache, usar configuración por defecto inmediatamente
        setConfig(DEFAULT_CONFIG);
        setIsInitialLoad(false);

        // 3. Cargar desde base de datos
        await loadFromDatabase(true);
      } catch (error) {
        console.error("Error in loadConfig:", error);
        // En caso de error, usar configuración por defecto
        setConfig(DEFAULT_CONFIG);
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    const loadFromDatabase = async (updateLoading: boolean = true) => {
      try {
        const { data, error } = await supabase
          .from("restaurant_config")
          .select("*")
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          console.error("Error loading restaurant config:", error);
          return;
        }

        if (data) {
          setConfig(data);
          saveToCache(data);
        } else {
          // Si no hay configuración en DB, crear una por defecto
          const { data: newConfig, error: insertError } = await supabase
            .from("restaurant_config")
            .insert(DEFAULT_CONFIG)
            .select()
            .single();

          if (insertError) {
            console.error("Error creating default config:", insertError);
          } else if (newConfig) {
            setConfig(newConfig);
            saveToCache(newConfig);
          }
        }
      } catch (error) {
        console.error("Error loading from database:", error);
      } finally {
        if (updateLoading) {
          setIsLoading(false);
        }
      }
    };

    loadConfig();
  }, []);

  const updateConfig = async (newConfig: RestaurantConfig) => {
    try {
      const { error } = await supabase.from("restaurant_config").update(newConfig).eq("id", newConfig.id);

      if (error) {
        console.error("Error updating restaurant config:", error);
        throw error;
      }

      setConfig(newConfig);
      saveToCache(newConfig);
    } catch (error) {
      console.error("Error updating restaurant config:", error);
      throw error;
    }
  };

  return (
    <RestaurantConfigContext.Provider value={{ config, updateConfig, isLoading, isInitialLoad }}>
      {children}
    </RestaurantConfigContext.Provider>
  );
};
