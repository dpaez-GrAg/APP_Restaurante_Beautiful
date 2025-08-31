-- Crear tabla para las mesas del restaurante
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  position_x DECIMAL,
  position_y DECIMAL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para combos de mesas
CREATE TABLE public.table_combinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  table_ids UUID[] NOT NULL,
  total_capacity INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para horarios del restaurante
CREATE TABLE public.restaurant_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Domingo, 1=Lunes, etc.
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para configuración del restaurante (extender la funcionalidad existente)
CREATE TABLE public.restaurant_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_name TEXT NOT NULL,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  logo_url TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  contact_address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_config ENABLE ROW LEVEL SECURITY;

-- Políticas para mesas (solo admin puede gestionar)
CREATE POLICY "Solo admin puede ver mesas" ON public.tables FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede crear mesas" ON public.tables FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede actualizar mesas" ON public.tables FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede eliminar mesas" ON public.tables FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Políticas para combos de mesas (solo admin puede gestionar)
CREATE POLICY "Solo admin puede ver combos" ON public.table_combinations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede crear combos" ON public.table_combinations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede actualizar combos" ON public.table_combinations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede eliminar combos" ON public.table_combinations FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Políticas para horarios (solo admin puede gestionar)
CREATE POLICY "Solo admin puede ver horarios" ON public.restaurant_schedules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede crear horarios" ON public.restaurant_schedules FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede actualizar horarios" ON public.restaurant_schedules FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede eliminar horarios" ON public.restaurant_schedules FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Políticas para configuración del restaurante (solo admin puede gestionar)
CREATE POLICY "Solo admin puede ver config" ON public.restaurant_config FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede crear config" ON public.restaurant_config FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Solo admin puede actualizar config" ON public.restaurant_config FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Triggers para actualizar timestamps
CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_table_combinations_updated_at
  BEFORE UPDATE ON public.table_combinations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_schedules_updated_at
  BEFORE UPDATE ON public.restaurant_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_config_updated_at
  BEFORE UPDATE ON public.restaurant_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();