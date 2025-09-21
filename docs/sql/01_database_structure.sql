-- ========================================
-- ESTRUCTURA COMPLETA DE BASE DE DATOS
-- Sistema de Reservas con Gestión de Usuarios
-- ========================================
-- Este archivo contiene toda la estructura de tablas, enums y triggers
-- necesarios para el funcionamiento del sistema.

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Crear tipos ENUM de forma segura
DO $$ 
BEGIN
    CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
    CREATE TYPE customer_classification AS ENUM ('NEUTRO', 'VIP', 'ALERTA', 'RED_FLAG');
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- DROP EXISTING FUNCTIONS (for idempotency)
-- ========================================

DROP FUNCTION IF EXISTS public.get_available_time_slots(date, integer, integer);
DROP FUNCTION IF EXISTS public.create_reservation_with_assignment(uuid, date, time, integer, text, integer);
-- TABLES
-- ========================================

-- Restaurant Configuration
CREATE TABLE IF NOT EXISTS public.restaurant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    latitude NUMERIC,
    longitude NUMERIC,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Restaurant Schedules (regular opening hours)
CREATE TABLE IF NOT EXISTS public.restaurant_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    opening_time TIME WITHOUT TIME ZONE NOT NULL,
    closing_time TIME WITHOUT TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Special Schedule Days (override regular schedule for specific dates)
CREATE TABLE IF NOT EXISTS public.special_schedule_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    opening_time TIME WITHOUT TIME ZONE NOT NULL,
    closing_time TIME WITHOUT TIME ZONE NOT NULL,
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Special Closed Days (restaurant closed on specific dates)
CREATE TABLE IF NOT EXISTS public.special_closed_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    is_range BOOLEAN NOT NULL DEFAULT false,
    range_start DATE,
    range_end DATE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tables (restaurant tables with capacity and positioning)
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    min_capacity INTEGER DEFAULT 1 CHECK (min_capacity > 0),
    max_capacity INTEGER CHECK (max_capacity IS NULL OR max_capacity >= capacity),
    extra_capacity INTEGER DEFAULT 0 CHECK (extra_capacity >= 0),
    position_x NUMERIC,
    position_y NUMERIC,
    shape TEXT DEFAULT 'square' CHECK (shape IN ('square', 'circle', 'rectangle')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table Combinations (predefined combinations of tables)
CREATE TABLE IF NOT EXISTS public.table_combinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    table_ids UUID[] NOT NULL,
    total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
    min_capacity INTEGER DEFAULT 1 CHECK (min_capacity > 0),
    max_capacity INTEGER CHECK (max_capacity IS NULL OR max_capacity >= total_capacity),
    extra_capacity INTEGER DEFAULT 0 CHECK (extra_capacity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Time Slots (available reservation time slots)
CREATE TABLE IF NOT EXISTS public.time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time TIME WITHOUT TIME ZONE NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 50 CHECK (max_capacity > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reservations
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    date DATE NOT NULL,
    time TIME WITHOUT TIME ZONE NOT NULL,
    guests INTEGER NOT NULL CHECK (guests > 0),
    duration_minutes INTEGER DEFAULT 120 CHECK (duration_minutes > 0),
    special_requests TEXT,
    status TEXT DEFAULT 'pending',
    start_at TIMESTAMP WITH TIME ZONE,
    end_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reservation Table Assignments (many-to-many between reservations and tables)
CREATE TABLE IF NOT EXISTS public.reservation_table_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES public.tables(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(reservation_id, table_id)
);

-- User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_restaurant_schedules_day ON public.restaurant_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_special_schedule_days_date ON public.special_schedule_days(date);
CREATE INDEX IF NOT EXISTS idx_special_closed_days_date ON public.special_closed_days(date);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON public.reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservation_table_assignments_reservation_id ON public.reservation_table_assignments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_table_assignments_table_id ON public.reservation_table_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_tables_active ON public.tables(is_active);
CREATE INDEX IF NOT EXISTS idx_time_slots_time ON public.time_slots(time);

-- ========================================
-- TRIGGER FUNCTIONS
-- ========================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- TRIGGERS (OPTIONAL - UNCOMMENT IF NEEDED)
-- ========================================

-- Uncomment the following triggers if you want automatic updated_at timestamps

-- CREATE TRIGGER IF NOT EXISTS trg_update_restaurant_config_updated_at
--     BEFORE UPDATE ON public.restaurant_config
--     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER IF NOT EXISTS trg_update_restaurant_schedules_updated_at
--     BEFORE UPDATE ON public.restaurant_schedules
--     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER IF NOT EXISTS trg_update_tables_updated_at
--     BEFORE UPDATE ON public.tables
--     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER IF NOT EXISTS trg_update_customers_updated_at
--     BEFORE UPDATE ON public.customers
--     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CREATE TRIGGER IF NOT EXISTS trg_update_reservations_updated_at
--     BEFORE UPDATE ON public.reservations
--     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User profile creation trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE public.restaurant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_closed_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Public read access policies for configuration and setup tables
CREATE POLICY "Allow all for config" ON public.restaurant_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for schedules" ON public.restaurant_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for special schedule days" ON public.special_schedule_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for special closed days" ON public.special_closed_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for tables" ON public.tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for combinations" ON public.table_combinations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for reservation table assignments" ON public.reservation_table_assignments FOR ALL USING (true) WITH CHECK (true);

-- Time slots - read only for public
CREATE POLICY "Permitir lectura de horarios públicos" ON public.time_slots FOR SELECT USING (true);

-- Customers policies
CREATE POLICY "Permitir creación de clientes para reservas" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir lectura de clientes para reservas" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Permitir actualización de clientes para reservas" ON public.customers FOR UPDATE USING (true);

-- Reservations policies
CREATE POLICY "Permitir creación de reservas públicas" ON public.reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir lectura de reservas públicas" ON public.reservations FOR SELECT USING (true);
CREATE POLICY "Permitir actualización de reservas públicas" ON public.reservations FOR UPDATE USING (true);

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable insert for authenticated users" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ========================================

-- Campos adicionales para límites de comensales
-- ========================================
-- ADD MAX_DINERS FIELD TO RESTAURANT_SCHEDULES
-- ========================================
-- Este script añade el campo max_diners a la tabla restaurant_schedules
-- para permitir configurar límites de comensales por turno

-- Añadir campo max_diners a restaurant_schedules
ALTER TABLE public.restaurant_schedules 
ADD COLUMN IF NOT EXISTS max_diners INTEGER;

-- Comentario para documentar el campo
COMMENT ON COLUMN public.restaurant_schedules.max_diners IS 'Número máximo de comensales permitidos para este turno/horario';

-- También añadir el campo a special_schedule_days para consistencia
ALTER TABLE public.special_schedule_days 
ADD COLUMN IF NOT EXISTS max_diners INTEGER;

COMMENT ON COLUMN public.special_schedule_days.max_diners IS 'Número máximo de comensales permitidos para este horario especial';

-- Actualizar valores por defecto (opcional - puedes ajustar según tus necesidades)
-- UPDATE public.restaurant_schedules SET max_diners = 50 WHERE max_diners IS NULL;
-- UPDATE public.special_schedule_days SET max_diners = 50 WHERE max_diners IS NULL;
