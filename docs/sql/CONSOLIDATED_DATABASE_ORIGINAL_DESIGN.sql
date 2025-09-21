-- ========================================
-- CONSOLIDACIÓN COMPLETA - DISEÑO ORIGINAL
-- ========================================
-- Este archivo consolida los archivos 01-07 manteniendo exactamente
-- el diseño original revisado y aprobado por el usuario.
-- NO modifica la estructura, solo organiza todo en un archivo.
-- 
-- ORDEN DE EJECUCIÓN: Solo ejecutar este archivo
-- RESULTADO: Sistema completo funcional con diseño original


-- ========================================
-- CONTENIDO DE: 01_database_structure.sql
-- ========================================

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
DROP FUNCTION IF EXISTS public.move_reservation_with_validation(uuid, date, time, uuid[], integer); -- Agregado
DROP FUNCTION IF EXISTS public.update_reservation_details(uuid, integer, text, text); -- Agregado
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, user_role); -- Agregado
DROP FUNCTION IF EXISTS public.admin_get_users(); -- Agregado
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text, user_role, boolean); -- Agregado
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid); -- Agregado
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
    email TEXT UNIQUE, -- Removido NOT NULL para hacer nullable
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
    created_by UUID REFERENCES public.profiles(id), -- Agregado campo created_by
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
-- CONTENIDO DE: 02_initial_data.sql
-- ========================================

-- ========================================
-- DATOS INICIALES DEL SISTEMA
-- ========================================
-- Este archivo contiene todos los datos iniciales necesarios
-- para el funcionamiento básico del sistema.

-- ========================================
-- RESTAURANT RESERVATION SYSTEM - SEED DATA
-- ========================================
-- This file contains comprehensive seed data for the restaurant system
-- Execute this AFTER running bootstrap_full.sql
-- Version: 2.0
-- Last updated: 2025-01-07

-- ========================================
-- RESTAURANT CONFIGURATION
-- ========================================

INSERT INTO public.restaurant_config (
    restaurant_name,
    hero_title,
    hero_subtitle,
    description,
    contact_phone,
    contact_email,
    contact_address,
    city,
    state,
    postcode,
    latitude,
    longitude,
    is_active
) VALUES (
    'Restaurante La Bella Vista',
    'Experiencia Gastronómica Única',
    'Donde cada plato cuenta una historia',
    'Un restaurante de alta cocina que combina tradición e innovación, ofreciendo una experiencia culinaria inolvidable en el corazón de la ciudad.',
    '+34 123 456 789',
    'reservas@labellavista.es',
    'Calle Gran Vía 123, Planta 5',
    'Madrid',
    'Madrid',
    '28013',
    40.4168,
    -3.7038,
    true
) ON CONFLICT DO NOTHING;

-- ========================================
-- RESTAURANT SCHEDULES (Weekly Hours)
-- ========================================

-- Monday to Thursday
INSERT INTO public.restaurant_schedules (day_of_week, opening_time, closing_time, is_active) VALUES
(1, '12:00', '23:30', true), -- Monday
(2, '12:00', '23:30', true), -- Tuesday  
(3, '12:00', '23:30', true), -- Wednesday
(4, '12:00', '23:30', true); -- Thursday

-- Friday and Saturday (extended hours)
INSERT INTO public.restaurant_schedules (day_of_week, opening_time, closing_time, is_active) VALUES
(5, '12:00', '01:00', true), -- Friday
(6, '12:00', '01:00', true); -- Saturday

-- Sunday (shorter hours)
INSERT INTO public.restaurant_schedules (day_of_week, opening_time, closing_time, is_active) VALUES
(0, '13:00', '22:00', true); -- Sunday

-- ========================================
-- TIME SLOTS
-- ========================================

-- Lunch service (12:00 - 16:30)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('12:00', 40),
('12:30', 40),
('13:00', 50),
('13:30', 50),
('14:00', 50),
('14:30', 45),
('15:00', 40),
('15:30', 35),
('16:00', 30),
('16:30', 25);

-- Dinner service (19:00 - 23:00)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('19:00', 30),
('19:30', 40),
('20:00', 50),
('20:30', 50),
('21:00', 50),
('21:30', 45),
('22:00', 40),
('22:30', 35),
('23:00', 30);

-- Late dinner (Friday/Saturday only)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('23:30', 25),
('00:00', 20),
('00:30', 15);

-- ========================================
-- TABLES
-- ========================================

-- Small tables (2 people)
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Mesa 1', 2, 1, 3, 1, 100, 100, 'circle', true),
('Mesa 2', 2, 1, 3, 1, 200, 100, 'circle', true),
('Mesa 3', 2, 1, 3, 1, 300, 100, 'circle', true),
('Mesa 4', 2, 1, 3, 1, 400, 100, 'circle', true),
('Mesa 5', 2, 1, 3, 1, 500, 100, 'circle', true);

-- Medium tables (4 people)
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Mesa 6', 4, 2, 6, 2, 100, 250, 'square', true),
('Mesa 7', 4, 2, 6, 2, 250, 250, 'square', true),
('Mesa 8', 4, 2, 6, 2, 400, 250, 'square', true),
('Mesa 9', 4, 2, 6, 2, 550, 250, 'square', true);

-- Large tables (6-8 people)
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Mesa 10', 6, 4, 8, 2, 150, 400, 'rectangle', true),
('Mesa 11', 6, 4, 8, 2, 350, 400, 'rectangle', true),
('Mesa 12', 8, 6, 10, 2, 200, 550, 'rectangle', true);

-- VIP/Private dining tables
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Sala Privada A', 10, 8, 12, 2, 600, 400, 'rectangle', true),
('Sala Privada B', 12, 10, 15, 3, 600, 550, 'rectangle', true);

-- Bar seating
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Barra 1', 1, 1, 1, 0, 50, 50, 'circle', true),
('Barra 2', 1, 1, 1, 0, 100, 50, 'circle', true),
('Barra 3', 1, 1, 1, 0, 150, 50, 'circle', true),
('Barra 4', 1, 1, 1, 0, 200, 50, 'circle', true),
('Barra 5', 1, 1, 1, 0, 250, 50, 'circle', true),
('Barra 6', 1, 1, 1, 0, 300, 50, 'circle', true);

-- ========================================
-- TABLE COMBINATIONS
-- ========================================

-- Combinations for larger groups
INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Combinación Romántica (Mesas 1-2)',
    ARRAY[t1.id, t2.id],
    4,
    3,
    6,
    2,
    true
FROM public.tables t1, public.tables t2
WHERE t1.name = 'Mesa 1' AND t2.name = 'Mesa 2';

INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Grupo Familiar (Mesas 6-7)',
    ARRAY[t1.id, t2.id],
    8,
    6,
    12,
    4,
    true
FROM public.tables t1, public.tables t2
WHERE t1.name = 'Mesa 6' AND t2.name = 'Mesa 7';

INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Evento Grande (Mesas 10-11-12)',
    ARRAY[t1.id, t2.id, t3.id],
    20,
    16,
    26,
    6,
    true
FROM public.tables t1, public.tables t2, public.tables t3
WHERE t1.name = 'Mesa 10' AND t2.name = 'Mesa 11' AND t3.name = 'Mesa 12';

INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Área VIP Completa',
    ARRAY[t1.id, t2.id],
    22,
    18,
    27,
    5,
    true
FROM public.tables t1, public.tables t2
WHERE t1.name = 'Sala Privada A' AND t2.name = 'Sala Privada B';

-- ========================================
-- SAMPLE CUSTOMERS
-- ========================================

INSERT INTO public.customers (name, email, phone) VALUES
('María González', 'maria.gonzalez@email.com', '+34 600 111 222'),
('Carlos Rodríguez', 'carlos.rodriguez@email.com', '+34 600 333 444'),
('Ana López', 'ana.lopez@email.com', '+34 600 555 666'),
('José Martín', 'jose.martin@email.com', '+34 600 777 888'),
('Isabel Fernández', 'isabel.fernandez@email.com', '+34 600 999 000'),
('Miguel Sánchez', 'miguel.sanchez@email.com', '+34 611 111 222'),
('Carmen Pérez', 'carmen.perez@email.com', '+34 622 333 444'),
('Antonio García', 'antonio.garcia@email.com', '+34 633 555 666'),
('Rosa Jiménez', 'rosa.jimenez@email.com', '+34 644 777 888'),
('Francisco Ruiz', 'francisco.ruiz@email.com', '+34 655 999 000'),
('Pilar Moreno', 'pilar.moreno@email.com', '+34 666 111 222'),
('Rafael Muñoz', 'rafael.munoz@email.com', '+34 677 333 444'),
('Teresa Álvarez', 'teresa.alvarez@email.com', '+34 688 555 666'),
('Andrés Romero', 'andres.romero@email.com', '+34 699 777 888'),
('Cristina Torres', 'cristina.torres@email.com', '+34 600 123 456');

-- ========================================
-- SAMPLE RESERVATIONS (Next 30 days)
-- ========================================

-- Week 1: Current week reservations
DO $$
DECLARE
    customer_ids UUID[];
    table_ids UUID[];
    today_date DATE := CURRENT_DATE;
    i INTEGER;
    random_customer UUID;
    random_table UUID;
    random_time TIME;
    reservation_id UUID;
BEGIN
    -- Get customer IDs
    SELECT array_agg(id) INTO customer_ids FROM public.customers;
    
    -- Get table IDs  
    SELECT array_agg(id) INTO table_ids FROM public.tables WHERE capacity <= 4;
    
    -- Generate reservations for the next 7 days
    FOR i IN 0..6 LOOP
        -- 3-5 lunch reservations per day
        FOR j IN 1..(3 + floor(random() * 3)::integer) LOOP
            random_customer := customer_ids[1 + floor(random() * array_length(customer_ids, 1))::integer];
            random_table := table_ids[1 + floor(random() * array_length(table_ids, 1))::integer];
            random_time := ('13:00'::time + (floor(random() * 8) * interval '30 minutes'));
            
            INSERT INTO public.reservations (
                customer_id, date, time, guests, status, duration_minutes,
                start_at, end_at, special_requests
            ) VALUES (
                random_customer,
                today_date + i,
                random_time,
                2 + floor(random() * 3)::integer,
                CASE 
                    WHEN random() < 0.8 THEN 'confirmed'
                    WHEN random() < 0.95 THEN 'pending'
                    ELSE 'cancelled'
                END,
                90 + floor(random() * 60)::integer,
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid',
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid' + interval '2 hours',
                CASE 
                    WHEN random() < 0.3 THEN 'Mesa junto a la ventana por favor'
                    WHEN random() < 0.5 THEN 'Celebración de aniversario'
                    WHEN random() < 0.7 THEN 'Alergia a los frutos secos'
                    ELSE NULL
                END
            ) RETURNING id INTO reservation_id;
            
            -- Assign table
            INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
            VALUES (reservation_id, random_table);
        END LOOP;
        
        -- 4-7 dinner reservations per day
        FOR j IN 1..(4 + floor(random() * 4)::integer) LOOP
            random_customer := customer_ids[1 + floor(random() * array_length(customer_ids, 1))::integer];
            random_table := table_ids[1 + floor(random() * array_length(table_ids, 1))::integer];
            random_time := ('20:00'::time + (floor(random() * 6) * interval '30 minutes'));
            
            INSERT INTO public.reservations (
                customer_id, date, time, guests, status, duration_minutes,
                start_at, end_at, special_requests
            ) VALUES (
                random_customer,
                today_date + i,
                random_time,
                2 + floor(random() * 4)::integer,
                CASE 
                    WHEN random() < 0.85 THEN 'confirmed'
                    WHEN random() < 0.97 THEN 'pending'
                    ELSE 'cancelled'
                END,
                120 + floor(random() * 60)::integer,
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid',
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid' + interval '2.5 hours',
                CASE 
                    WHEN random() < 0.2 THEN 'Mesa tranquila para una cita'
                    WHEN random() < 0.4 THEN 'Cumpleaños - postre especial'
                    WHEN random() < 0.6 THEN 'Cena de negocios'
                    ELSE NULL
                END
            ) RETURNING id INTO reservation_id;
            
            -- Assign table
            INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
            VALUES (reservation_id, random_table);
        END LOOP;
    END LOOP;
END $$;

-- ========================================
-- SPECIAL SCHEDULE EXAMPLES
-- ========================================

-- New Year's Eve special hours
INSERT INTO public.special_schedule_days (date, opening_time, closing_time, reason, is_active) VALUES
('2025-12-31', '19:00', '02:00', 'Nochevieja - Cena especial', true);

-- Valentine's Day special hours
INSERT INTO public.special_schedule_days (date, opening_time, closing_time, reason, is_active) VALUES
('2025-02-14', '18:00', '01:00', 'San Valentín - Cenas románticas', true);

-- ========================================
-- SPECIAL CLOSED DAYS EXAMPLES
-- ========================================

-- Christmas Day
INSERT INTO public.special_closed_days (date, is_range, reason) VALUES
('2025-12-25', false, 'Navidad - Cerrado por festividad');

-- Summer vacation range
INSERT INTO public.special_closed_days (date, is_range, range_start, range_end, reason) VALUES
('2025-08-01', true, '2025-08-01', '2025-08-15', 'Vacaciones de verano del personal');

-- Staff training day
INSERT INTO public.special_closed_days (date, is_range, reason) VALUES
('2025-03-15', false, 'Formación del personal - Cerrado');

-- ========================================
-- SAMPLE ADMIN USER PROFILE
-- ========================================

-- Note: This will only work if there's a user in auth.users with this ID
-- In a real scenario, this would be created through Supabase Auth
-- INSERT INTO public.profiles (id, email, full_name, role) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'admin@labellavista.es', 'Administrador Principal', 'admin');

-- ========================================
-- DATA VERIFICATION QUERIES
-- ========================================

-- Uncomment these to verify your data after seeding:

-- SELECT 'Restaurant Config' as section, count(*) as records FROM public.restaurant_config
-- UNION ALL
-- SELECT 'Schedules', count(*) FROM public.restaurant_schedules  
-- UNION ALL
-- SELECT 'Time Slots', count(*) FROM public.time_slots
-- UNION ALL
-- SELECT 'Tables', count(*) FROM public.tables
-- UNION ALL  
-- SELECT 'Table Combinations', count(*) FROM public.table_combinations
-- UNION ALL
-- SELECT 'Customers', count(*) FROM public.customers
-- UNION ALL
-- SELECT 'Reservations', count(*) FROM public.reservations
-- UNION ALL
-- SELECT 'Table Assignments', count(*) FROM public.reservation_table_assignments
-- ORDER BY section;

-- ========================================
-- SEED COMPLETION
-- ========================================

-- Seed data has been successfully inserted
-- The restaurant is now ready for testing with realistic data
-- You can start making reservations and testing all functionality

-- ========================================
-- CONTENIDO DE: 03_reservation_functions.sql
-- ========================================

-- ========================================
-- FUNCIONES DE RESERVAS Y DISPONIBILIDAD - VERSIÓN LIMPIA
-- ========================================
-- Este archivo contiene todas las funciones relacionadas con:
-- - Verificación de disponibilidad
-- - Creación de reservas
-- - Asignación de mesas
-- - APIs de disponibilidad

-- ========================================
-- LIMPIAR FUNCIONES EXISTENTES
-- ========================================
DROP FUNCTION IF EXISTS get_available_time_slots(date, integer, integer);
DROP FUNCTION IF EXISTS get_available_time_slots(date, integer, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability(date, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability_with_capacity(date, integer, integer);
DROP FUNCTION IF EXISTS create_reservation_with_assignment(uuid, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS create_reservation_with_specific_tables(uuid, date, time, integer, text, uuid[], integer);
DROP FUNCTION IF EXISTS is_table_available(uuid, date, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS check_diners_limit(date, time, integer);
DROP FUNCTION IF EXISTS move_reservation_with_validation(uuid, date, time, uuid[], integer); -- Agregado
DROP FUNCTION IF EXISTS update_reservation_details(uuid, integer, text, text); -- Agregado

-- ========================================
-- FUNCIÓN 1: VERIFICAR DISPONIBILIDAD DE MESA
-- ========================================
CREATE OR REPLACE FUNCTION is_table_available(
    p_table_id uuid,
    p_date date,
    p_start_time timestamptz,
    p_end_time timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE rta.table_id = p_table_id
          AND r.date = p_date
          AND r.status IN ('confirmed', 'seated')
          AND (
            -- Verificar solapamiento de horarios
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < p_end_time)
            AND
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
              + (COALESCE(r.duration_minutes, 120) || ' minutes')::interval) > p_start_time)
          )
    );
END;
$$;

-- ========================================
-- FUNCIÓN 2: VERIFICAR LÍMITES DE COMENSALES
-- ========================================
CREATE OR REPLACE FUNCTION check_diners_limit(
    p_date date,
    p_time time,
    p_guests integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week integer;
    v_schedule_record record;
    v_current_diners integer;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Verificar horarios especiales primero
    FOR v_schedule_record IN
        SELECT ssd.opening_time, ssd.closing_time, ssd.max_diners
        FROM public.special_schedule_days ssd
        WHERE ssd.date = p_date AND ssd.is_active = true
          AND p_time >= ssd.opening_time AND p_time < ssd.closing_time
        ORDER BY ssd.opening_time
        LIMIT 1
    LOOP
        IF v_schedule_record.max_diners IS NOT NULL THEN
            SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
            FROM public.reservations r
            WHERE r.date = p_date
              AND r.status IN ('confirmed', 'seated')
              AND r.time >= v_schedule_record.opening_time 
              AND r.time < v_schedule_record.closing_time;
              
            IF (v_current_diners + p_guests) > v_schedule_record.max_diners THEN
                RETURN json_build_object(
                    'success', false, 
                    'error', 'Exceeds maximum diners limit for this time slot',
                    'current_diners', v_current_diners,
                    'max_diners', v_schedule_record.max_diners
                );
            END IF;
        END IF;
        
        RETURN json_build_object('success', true);
    END LOOP;
    
    -- Si no hay horarios especiales, verificar horarios regulares
    FOR v_schedule_record IN
        SELECT rs.opening_time, rs.closing_time, rs.max_diners
        FROM public.restaurant_schedules rs
        WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
          AND p_time >= rs.opening_time AND p_time < rs.closing_time
        ORDER BY rs.opening_time
        LIMIT 1
    LOOP
        IF v_schedule_record.max_diners IS NOT NULL THEN
            SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
            FROM public.reservations r
            WHERE r.date = p_date
              AND r.status IN ('confirmed', 'seated')
              AND r.time >= v_schedule_record.opening_time 
              AND r.time < v_schedule_record.closing_time;
              
            IF (v_current_diners + p_guests) > v_schedule_record.max_diners THEN
                RETURN json_build_object(
                    'success', false, 
                    'error', 'Exceeds maximum diners limit for this time slot',
                    'current_diners', v_current_diners,
                    'max_diners', v_schedule_record.max_diners
                );
            END IF;
        END IF;
        
        RETURN json_build_object('success', true);
    END LOOP;
    
    -- Si no hay límites configurados, permitir la reserva
    RETURN json_build_object('success', true);
END;
$$;

-- ========================================
-- FUNCIÓN 3: OBTENER SLOTS DISPONIBLES
-- ========================================
CREATE OR REPLACE FUNCTION get_available_time_slots(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 120
)
RETURNS TABLE(id uuid, slot_time time, capacity integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week integer;
    v_special_closed boolean;
    rec record;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_available_capacity integer;
    v_schedule_record record;
    v_current_diners integer;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Verificar si es un día especial cerrado
    SELECT COUNT(*) > 0 INTO v_special_closed
    FROM public.special_closed_days scd
    WHERE (
        (NOT scd.is_range AND scd.date = p_date) OR
        (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
    );

    IF v_special_closed THEN
        RETURN;
    END IF;

    -- Procesar horarios regulares
    FOR v_schedule_record IN
        SELECT rs.opening_time, rs.closing_time, rs.max_diners
        FROM public.restaurant_schedules rs
        WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
        ORDER BY rs.opening_time
    LOOP
        -- Procesar cada time slot en este horario
        FOR rec IN
            SELECT ts.id, ts.time, ts.max_capacity
            FROM public.time_slots ts
            WHERE ts.time >= v_schedule_record.opening_time 
              AND ts.time < v_schedule_record.closing_time
            ORDER BY ts.time
        LOOP
            -- Calcular el tiempo de inicio y fin de la reserva
            v_start_at := ((p_date::text || ' ' || rec.time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
            v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

            -- Calcular capacidad disponible (mesas NO ocupadas)
            SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_available_capacity
            FROM public.tables t
            WHERE t.is_active = true
              AND is_table_available(t.id, p_date, v_start_at, v_end_at);

            -- Calcular comensales actuales en el turno (si hay límite configurado)
            v_current_diners := 0;
            IF v_schedule_record.max_diners IS NOT NULL THEN
                SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
                FROM public.reservations r
                WHERE r.date = p_date
                  AND r.status IN ('confirmed', 'seated')
                  AND r.time >= v_schedule_record.opening_time 
                  AND r.time < v_schedule_record.closing_time;
            END IF;

            -- Verificar disponibilidad
            IF LEAST(v_available_capacity, rec.max_capacity) >= p_guests THEN
                -- Si hay límite de comensales por turno, verificar que no se exceda
                IF v_schedule_record.max_diners IS NULL OR (v_current_diners + p_guests) <= v_schedule_record.max_diners THEN
                    id := rec.id;
                    slot_time := rec.time;
                    capacity := LEAST(v_available_capacity, rec.max_capacity);
                    RETURN NEXT;
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    RETURN;
END;
$$;

-- ========================================
-- FUNCIÓN 4: API VERIFICAR DISPONIBILIDAD
-- ========================================
CREATE OR REPLACE FUNCTION api_check_availability(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available_slots json[];
    v_result json;
    v_total_available_slots integer;
    slot_record record;
BEGIN
    v_available_slots := ARRAY[]::json[];
    v_total_available_slots := 0;

    -- Obtener slots disponibles
    FOR slot_record IN
        SELECT * FROM get_available_time_slots(p_date, p_guests, p_duration_minutes)
    LOOP
        v_available_slots := v_available_slots || json_build_object(
            'id', slot_record.id,
            'time', slot_record.slot_time,
            'capacity', slot_record.capacity
        );
        v_total_available_slots := v_total_available_slots + 1;
    END LOOP;

    -- Construir respuesta final
    v_result := json_build_object(
        'available', v_total_available_slots > 0,
        'date', p_date,
        'guests', p_guests,
        'duration_minutes', p_duration_minutes,
        'available_slots', v_available_slots,
        'total_slots', v_total_available_slots
    );

    RETURN v_result;
END;
$$;

-- ========================================
-- FUNCIÓN 5: CREAR RESERVA CON ASIGNACIÓN AUTOMÁTICA
-- ========================================
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
    p_customer_id uuid,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_start_at TIMESTAMP WITH TIME ZONE;
    v_end_at TIMESTAMP WITH TIME ZONE;
    v_assigned_tables UUID[];
    v_table_record RECORD;
    v_needed_capacity INTEGER;
    v_current_capacity INTEGER;
    v_day_of_week INTEGER;
    v_schedule_exists BOOLEAN;
    v_special_closed BOOLEAN;
    v_special_schedule RECORD;
    v_combination RECORD;
    v_diners_check json;
BEGIN
    -- Verificar que el customer_id no sea NULL
    IF p_customer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Customer ID cannot be null');
    END IF;

    -- Normalize to Europe/Madrid
    v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

    v_day_of_week := EXTRACT(DOW FROM p_date);

    -- Check if restaurant is closed
    SELECT COUNT(*) > 0 INTO v_special_closed
    FROM public.special_closed_days 
    WHERE (
        (NOT is_range AND date = p_date) OR
        (is_range AND p_date BETWEEN range_start AND range_end)
    );
    IF v_special_closed THEN
        RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
    END IF;

    -- Check opening hours
    SELECT opening_time, closing_time INTO v_special_schedule
    FROM public.special_schedule_days 
    WHERE date = p_date AND is_active = true
    LIMIT 1;

    IF FOUND THEN
        IF p_time < v_special_schedule.opening_time OR p_time >= v_special_schedule.closing_time THEN
            RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
        END IF;
    ELSE
        SELECT COUNT(*) > 0 INTO v_schedule_exists
        FROM public.restaurant_schedules 
        WHERE day_of_week = v_day_of_week AND is_active = true
          AND p_time >= opening_time AND p_time < closing_time;
        IF NOT v_schedule_exists THEN
            RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
        END IF;
    END IF;

    -- Verificar límites de comensales por turno
    SELECT check_diners_limit(p_date, p_time, p_guests) INTO v_diners_check;
    IF (v_diners_check->>'success')::boolean = false THEN
        RETURN v_diners_check;
    END IF;

    v_needed_capacity := p_guests;
    v_assigned_tables := ARRAY[]::UUID[];
    v_current_capacity := 0;

    -- PASO 1: Buscar una mesa individual con capacidad suficiente
    SELECT t.id
    INTO v_table_record
    FROM public.tables t
    WHERE t.is_active = true
      AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
      AND is_table_available(t.id, p_date, v_start_at, v_end_at)
    ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
    LIMIT 1;

    IF FOUND THEN
        -- Encontramos una mesa individual que funciona
        v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
        SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
        FROM public.tables t WHERE t.id = v_table_record.id;
    ELSE
        -- PASO 2: No hay mesa individual, buscar combinaciones válidas
        FOR v_combination IN
            SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
            FROM public.table_combinations tc
            WHERE tc.is_active = true
              AND p_guests >= COALESCE(tc.min_capacity, 1)
              AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
              AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
            ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC
        LOOP
            -- Check if all tables in this combination are available
            IF (
                SELECT bool_and(is_table_available(table_id, p_date, v_start_at, v_end_at))
                FROM unnest(v_combination.table_ids) AS table_id
            ) THEN
                -- This combination is available
                v_assigned_tables := v_combination.table_ids;
                v_current_capacity := v_combination.effective_capacity;
                EXIT;
            END IF;
        END LOOP;

        -- Si no encontramos combinación válida, la reserva no se puede realizar
        IF array_length(v_assigned_tables, 1) = 0 OR v_assigned_tables IS NULL THEN
            RETURN json_build_object('success', false, 'error', 'No hay mesas disponibles para esta capacidad');
        END IF;
    END IF;

    -- Verificar que tenemos capacidad suficiente
    IF v_current_capacity < v_needed_capacity THEN
        RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
    END IF;

    INSERT INTO public.reservations (
        customer_id, date, time, guests, special_requests, 
        status, duration_minutes, start_at, end_at, created_by
    )
    VALUES (
        p_customer_id, p_date, p_time, p_guests, p_special_requests, 
        'confirmed', p_duration_minutes, v_start_at, v_end_at, auth.uid()
    )
    RETURNING id INTO v_reservation_id;

    FOR i IN 1..array_length(v_assigned_tables, 1) LOOP
        INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
        VALUES (v_reservation_id, v_assigned_tables[i]);
    END LOOP;

    RETURN json_build_object(
        'success', true, 
        'reservation_id', v_reservation_id,
        'assigned_tables', v_assigned_tables,
        'capacity_used', v_current_capacity,
        'guests_requested', p_guests
    );
END;
$$;

-- ========================================
-- FUNCIÓN 6: MOVER RESERVA CON VALIDACIÓN
-- ========================================
CREATE OR REPLACE FUNCTION public.move_reservation_with_validation(
    p_reservation_id UUID,
    p_new_date DATE,
    p_new_time TIME,
    p_new_table_ids UUID[],
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_table_id UUID;
    v_conflict_count INTEGER;
BEGIN
    -- Verificar que la reserva existe
    SELECT * INTO v_reservation
    FROM public.reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Reserva no encontrada'
        );
    END IF;
    
    -- Verificar disponibilidad de las mesas en la nueva fecha/hora
    FOREACH v_table_id IN ARRAY p_new_table_ids
    LOOP
        -- Verificar que la mesa existe
        IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = v_table_id AND is_active = true) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Una o más mesas no existen o no están activas'
            );
        END IF;
        
        -- Verificar conflictos (excluyendo la reserva actual)
        SELECT COUNT(*) INTO v_conflict_count
        FROM public.reservations r
        JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
        WHERE rta.table_id = v_table_id
          AND r.id != p_reservation_id
          AND r.date = p_new_date
          AND r.status IN ('confirmed', 'seated', 'pending')
          AND (
              -- Verificar solapamiento de horarios
              (r.time <= p_new_time AND (r.time + INTERVAL '1 minute' * COALESCE(r.duration_minutes, 120)) > p_new_time)
              OR
              (p_new_time <= r.time AND (p_new_time + INTERVAL '1 minute' * p_duration_minutes) > r.time)
          );
          
        IF v_conflict_count > 0 THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Conflicto de horario con otra reserva en una de las mesas seleccionadas'
            );
        END IF;
    END LOOP;
    
    -- Si llegamos aquí, no hay conflictos. Proceder con la actualización
    BEGIN
        -- Actualizar la reserva
        UPDATE public.reservations
        SET 
            date = p_new_date,
            time = p_new_time,
            duration_minutes = p_duration_minutes,
            updated_at = NOW()
        WHERE id = p_reservation_id;
        
        -- Eliminar asignaciones de mesas anteriores
        DELETE FROM public.reservation_table_assignments
        WHERE reservation_id = p_reservation_id;
        
        -- Crear nuevas asignaciones de mesas
        FOREACH v_table_id IN ARRAY p_new_table_ids
        LOOP
            INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
            VALUES (p_reservation_id, v_table_id);
        END LOOP;
        
        RETURN json_build_object(
            'success', true,
            'message', 'Reserva movida exitosamente',
            'reservation_id', p_reservation_id
        );
        
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al actualizar la reserva: ' || SQLERRM
        );
    END;
END;
$$;

-- ========================================
-- FUNCIÓN 7: ACTUALIZAR DETALLES DE RESERVA
-- ========================================
CREATE OR REPLACE FUNCTION public.update_reservation_details(
    p_reservation_id UUID,
    p_guests INTEGER,
    p_special_requests TEXT,
    p_status TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar que la reserva existe
    IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE id = p_reservation_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Reserva no encontrada'
        );
    END IF;
    
    -- Actualizar detalles de la reserva
    UPDATE public.reservations
    SET 
        guests = p_guests,
        special_requests = p_special_requests,
        status = p_status,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Detalles de reserva actualizados exitosamente'
    );
END;
$$;

-- ========================================
-- LIMPIAR CACHE Y COMENTARIOS
-- ========================================
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION is_table_available IS 'Verifica si una mesa está disponible en un horario específico';
COMMENT ON FUNCTION check_diners_limit IS 'Verifica límites de comensales por turno';
COMMENT ON FUNCTION get_available_time_slots IS 'Obtiene slots de tiempo disponibles para una fecha y número de huéspedes';
COMMENT ON FUNCTION api_check_availability IS 'API para verificar disponibilidad de reservas';
COMMENT ON FUNCTION create_reservation_with_assignment IS 'Crea una reserva con asignación automática de mesas';
COMMENT ON FUNCTION move_reservation_with_validation IS 'Mueve una reserva a una nueva fecha/hora con validación';
COMMENT ON FUNCTION update_reservation_details IS 'Actualiza detalles de una reserva';

-- ========================================
-- FINALIZACIÓN
-- ========================================
SELECT 'FUNCIONES DE RESERVAS CREADAS' as status,
       'Todas las funciones del sistema han sido instaladas correctamente' as mensaje;


-- ========================================
-- CONTENIDO DE: 04_customer_functions.sql
-- ========================================

-- ========================================
-- FUNCIONES DE GESTIÓN DE CLIENTES
-- ========================================
-- Este archivo contiene todas las funciones relacionadas con:
-- - Gestión de clientes
-- - Clasificación de clientes (VIP, NEUTRO, ALERTA, RED FLAG)
-- - Email opcional en customers


-- Funciones de: fix_create_customer_function.sql
-- ========================================
-- ========================================
-- CORREGIR FUNCIÓN create_customer_optional_email
-- ========================================
-- La función está intentando usar ON CONFLICT (email) pero eliminamos la restricción UNIQUE

-- Eliminar la función existente
DROP FUNCTION IF EXISTS create_customer_optional_email(text, text, text);

-- Recrear la función sin ON CONFLICT
CREATE OR REPLACE FUNCTION create_customer_optional_email(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_generated_email TEXT;
    v_existing_customer UUID;
BEGIN
    -- Si no se proporciona email, generar uno único
    IF p_email IS NULL OR p_email = '' THEN
        v_generated_email := LOWER(REPLACE(p_name, ' ', '')) || '_' || 
                            EXTRACT(EPOCH FROM NOW())::bigint || '@noemail.local';
    ELSE
        v_generated_email := p_email;
    END IF;
  
    -- Buscar si ya existe un customer con el mismo teléfono (más confiable que email)
    IF p_phone IS NOT NULL AND p_phone != '' THEN
        SELECT id INTO v_existing_customer
        FROM public.customers 
        WHERE phone = p_phone
        LIMIT 1;
        
        -- Si existe, actualizar sus datos y devolver el ID
        IF v_existing_customer IS NOT NULL THEN
            UPDATE public.customers 
            SET name = p_name,
                email = v_generated_email,
                phone = p_phone,
                updated_at = now()
            WHERE id = v_existing_customer;
            
            RETURN v_existing_customer;
        END IF;
    END IF;
  
    -- Si no existe, crear nuevo customer
    INSERT INTO public.customers (name, phone, email)
    VALUES (p_name, p_phone, v_generated_email)
    RETURNING id INTO v_customer_id;
  
    RETURN v_customer_id;
END;
$$;

-- ========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ========================================
COMMENT ON FUNCTION create_customer_optional_email IS 'Crea o actualiza un cliente con email opcional';

-- NOTA: Para probar la función, usar después de ejecutar este script:
-- SELECT create_customer_optional_email('Diego Test', '777666555', null) as customer_id;
-- 
-- Verificar que el customer se creó:
-- SELECT id, name, email, phone FROM public.customers WHERE name = 'Diego Test';

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Funciones de: add_customer_classification_system.sql
-- ========================================
-- ========================================
-- SISTEMA DE CLASIFICACIÓN DE CLIENTES
-- ========================================
-- Añade clasificación de clientes con historial de cambios

-- 1. El enum customer_classification ya existe en 01_database_structure.sql
-- No necesitamos crearlo de nuevo

-- 2. Añadir campos a la tabla customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS classification customer_classification DEFAULT 'NEUTRO',
ADD COLUMN IF NOT EXISTS classification_notes TEXT,
ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS classification_updated_by UUID REFERENCES auth.users(id);

-- 3. Crear tabla para historial de cambios de clasificación
CREATE TABLE IF NOT EXISTS customer_classification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    old_classification customer_classification,
    new_classification customer_classification NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_customers_classification ON customers(classification);
CREATE INDEX IF NOT EXISTS idx_customers_classification_updated_at ON customers(classification_updated_at);
CREATE INDEX IF NOT EXISTS idx_customer_classification_history_customer_id ON customer_classification_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_classification_history_changed_at ON customer_classification_history(changed_at);

-- 5. Crear función para actualizar clasificación con historial
CREATE OR REPLACE FUNCTION update_customer_classification(
    p_customer_id UUID,
    p_new_classification customer_classification,
    p_notes TEXT DEFAULT NULL,
    p_changed_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_classification customer_classification;
BEGIN
    -- Obtener clasificación actual
    SELECT classification INTO v_old_classification 
    FROM customers 
    WHERE id = p_customer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado';
    END IF;
    
    -- Solo actualizar si la clasificación cambió
    IF v_old_classification != p_new_classification THEN
        -- Actualizar customer
        UPDATE customers 
        SET 
            classification = p_new_classification,
            classification_notes = p_notes,
            classification_updated_at = NOW(),
            classification_updated_by = p_changed_by,
            updated_at = NOW()
        WHERE id = p_customer_id;
        
        -- Insertar en historial
        INSERT INTO customer_classification_history (
            customer_id,
            old_classification,
            new_classification,
            notes,
            changed_by
        ) VALUES (
            p_customer_id,
            v_old_classification,
            p_new_classification,
            p_notes,
            p_changed_by
        );
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Crear función para obtener clientes con información de reservas
CREATE OR REPLACE FUNCTION get_customers_with_stats(
    p_search TEXT DEFAULT NULL,
    p_classification customer_classification DEFAULT NULL,
    p_order_by TEXT DEFAULT 'name',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    email TEXT,
    classification customer_classification,
    classification_notes TEXT,
    classification_updated_at TIMESTAMP WITH TIME ZONE,
    total_reservations BIGINT,
    last_reservation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.classification,
        c.classification_notes,
        c.classification_updated_at,
        COALESCE(r.total_reservations, 0) as total_reservations,
        r.last_reservation_date,
        c.created_at
    FROM customers c
    LEFT JOIN (
        SELECT 
            customer_id,
            COUNT(*) as total_reservations,
            MAX(date) as last_reservation_date
        FROM reservations 
        WHERE status IN ('confirmed', 'completed')
        GROUP BY customer_id
    ) r ON c.id = r.customer_id
    WHERE 
        (p_search IS NULL OR 
         c.name ILIKE '%' || p_search || '%' OR 
         c.phone ILIKE '%' || p_search || '%')
        AND (p_classification IS NULL OR c.classification = p_classification)
    ORDER BY 
        CASE 
            WHEN p_order_by = 'name' THEN c.name
            WHEN p_order_by = 'classification' THEN c.classification::text
            WHEN p_order_by = 'last_reservation' THEN r.last_reservation_date::text
            ELSE c.name
        END
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Crear función para obtener historial de clasificación de un cliente
CREATE OR REPLACE FUNCTION get_customer_classification_history(
    p_customer_id UUID
) RETURNS TABLE (
    id UUID,
    old_classification customer_classification,
    new_classification customer_classification,
    notes TEXT,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.old_classification,
        h.new_classification,
        h.notes,
        h.changed_by,
        h.changed_at
    FROM customer_classification_history h
    WHERE h.customer_id = p_customer_id
    ORDER BY h.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Crear políticas RLS (Row Level Security)
ALTER TABLE customer_classification_history ENABLE ROW LEVEL SECURITY;

-- Política para leer historial (usuarios autenticados)
CREATE POLICY "Users can read classification history" ON customer_classification_history
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para insertar historial (usuarios autenticados)
CREATE POLICY "Users can insert classification history" ON customer_classification_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 9. Verificar instalación
SELECT 'CLASIFICACIÓN DE CLIENTES INSTALADA' as status,
       COUNT(*) as total_customers,
       COUNT(CASE WHEN classification = 'VIP' THEN 1 END) as vip_customers,
       COUNT(CASE WHEN classification = 'NEUTRO' THEN 1 END) as neutro_customers,
       COUNT(CASE WHEN classification = 'ALERTA' THEN 1 END) as alerta_customers,
       COUNT(CASE WHEN classification = 'RED_FLAG' THEN 1 END) as red_flag_customers
FROM customers;


-- ========================================
-- CONTENIDO DE: 05_user_management.sql
-- ========================================

-- ========================================
-- SISTEMA DE GESTIÓN DE USUARIOS
-- ========================================
-- Este archivo contiene el sistema completo de gestión de usuarios:
-- - Roles: admin y user
-- - Permisos granulares
-- - Funciones de administración de usuarios

-- ========================================
-- USER MANAGEMENT SYSTEM - DATABASE UPDATES
-- ========================================
-- This script adds user management functionality to the existing system
-- Execute this after the main bootstrap to add user roles and permissions

-- Create user role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing profiles to have admin role (for current users)
UPDATE public.profiles 
SET role = 'admin', is_active = true, updated_at = now()
WHERE role IS NULL OR role != 'admin';

-- Create function to manage user creation by admins
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role user_role DEFAULT 'user'
)
RETURNS JSON AS $$
DECLARE
    new_user_id UUID;
    result JSON;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RETURN json_build_object('error', 'Unauthorized: Only admins can create users');
    END IF;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RETURN json_build_object('error', 'Email already exists');
    END IF;

    -- Create user in auth.users (this is a simplified version)
    -- Note: In production, you'd use Supabase Admin API for this
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        '',
        '',
        '',
        ''
    ) RETURNING id INTO new_user_id;

    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
    VALUES (new_user_id, p_email, p_full_name, p_role, true, now(), now());

    RETURN json_build_object('success', true, 'user_id', new_user_id, 'message', 'User created successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user details (admin only)
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id UUID,
    p_full_name TEXT DEFAULT NULL,
    p_role user_role DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RETURN json_build_object('error', 'Unauthorized: Only admins can update users');
    END IF;

    -- Check if target user exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    -- Update profile
    UPDATE public.profiles 
    SET 
        full_name = COALESCE(p_full_name, full_name),
        role = COALESCE(p_role, role),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'message', 'User updated successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to change user password (admin only)
CREATE OR REPLACE FUNCTION public.admin_change_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS JSON AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RETURN json_build_object('error', 'Unauthorized: Only admins can change passwords');
    END IF;

    -- Update password in auth.users
    UPDATE auth.users 
    SET 
        encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    RETURN json_build_object('success', true, 'message', 'Password updated successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role user_role,
    is_active BOOLEAN,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    creator_name TEXT
) AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can view users';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role::user_role,  -- CAST CORREGIDO: de text a user_role
        p.is_active,
        p.created_by,
        p.created_at,
        p.updated_at,
        creator.full_name as creator_name
    FROM public.profiles p
    LEFT JOIN public.profiles creator ON p.created_by = creator.id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- New RLS policies
CREATE POLICY "Users can view own profile or admins can view all" 
ON public.profiles FOR SELECT 
USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can update own profile or admins can update any" 
ON public.profiles FOR UPDATE 
USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Only admins can insert profiles" 
ON public.profiles FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users TO authenticated;


-- ========================================
-- CONTENIDO DE: 06_storage_and_permissions.sql
-- ========================================

-- ========================================
-- STORAGE Y PERMISOS FINALES
-- ========================================
-- Este archivo contiene:
-- - Configuración de storage para imágenes
-- - Políticas RLS finales
-- - Permisos y grants necesarios

-- ========================================
-- CONFIGURAR STORAGE PARA IMÁGENES DEL RESTAURANTE (VERSIÓN CORREGIDA)
-- ========================================
-- Este script verifica y configura el bucket de storage necesario

-- 1. Verificar si el bucket existe
SELECT 'BUCKETS EXISTENTES' as check_type,
       id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'restaurant-images';

-- 2. Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images', 
  true,  -- Público para que las imágenes sean accesibles
  5242880,  -- 5MB límite
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']  -- Solo imágenes
)
ON CONFLICT (id) DO NOTHING;

-- 3. Verificar políticas de RLS existentes
SELECT 'POLÍTICAS STORAGE EXISTENTES' as check_type,
       schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 4. Eliminar políticas existentes si existen (para recrearlas)
DROP POLICY IF EXISTS "Public read access for restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete restaurant images" ON storage.objects;

-- 5. Crear políticas de acceso para el bucket
-- Política para permitir lectura pública de imágenes
CREATE POLICY "Public read access for restaurant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-images');

-- Política para permitir subida de imágenes (autenticado)
CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'restaurant-images');

-- Política para permitir actualización de imágenes (autenticado)
CREATE POLICY "Authenticated users can update restaurant images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'restaurant-images')
WITH CHECK (bucket_id = 'restaurant-images');

-- Política para permitir eliminación de imágenes (autenticado)
CREATE POLICY "Authenticated users can delete restaurant images"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurant-images');

-- 6. Verificar que las políticas se crearon correctamente
SELECT 'POLÍTICAS CREADAS' as check_type,
       policyname, cmd, permissive
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%restaurant images%';

-- 7. Verificar configuración final del bucket
SELECT 'CONFIGURACIÓN FINAL' as check_type,
       id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
WHERE name = 'restaurant-images';

-- 8. Probar acceso al bucket (opcional)
SELECT 'TEST BUCKET ACCESS' as test_type,
       'Bucket configurado correctamente' as message;

-- Permisos finales del sistema
GRANT USAGE ON SCHEMA public TO anon, authenticated;


-- ========================================
-- CONTENIDO DE: 07_complete_vps_setup.sql
-- ========================================

-- ========================================
-- 07 - CONFIGURACIÓN COMPLETA PARA VPS - VERSIÓN FINAL
-- ========================================
-- Este archivo contiene todo lo necesario para configurar el sistema en VPS
-- Ejecutar DESPUÉS de los archivos 01-06 existentes
-- VERSIÓN CORREGIDA: Incluye fix para admin_get_users con cast de role

-- ========================================
-- PARTE 0: LIMPIAR FUNCIONES EXISTENTES
-- ========================================

-- Eliminar TODAS las versiones posibles de funciones admin que pueden tener conflictos
DROP FUNCTION IF EXISTS public.admin_get_users();

-- Versiones de admin_create_user
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, user_role, text);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, user_role);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text);

-- Versiones de admin_update_user
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, user_role, boolean);
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text, user_role, boolean);
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text, user_role);
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text);

-- Versiones de admin_delete_user
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

-- Versiones de admin_create_reservation
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, integer, integer, text);
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, time, integer, text, integer);

-- Versiones de admin_get_reservations
DROP FUNCTION IF EXISTS public.admin_get_reservations(date, date, text);
DROP FUNCTION IF EXISTS public.admin_get_reservations();

-- Versiones de admin_update_reservation_status
DROP FUNCTION IF EXISTS public.admin_update_reservation_status(uuid, reservation_status);

-- Versiones de admin_cancel_reservation
DROP FUNCTION IF EXISTS public.admin_cancel_reservation(uuid);

-- Eliminar función de cliente que puede tener conflictos de parámetros
DROP FUNCTION IF EXISTS public.create_customer_optional_email(text, text, text);
DROP FUNCTION IF EXISTS public.create_customer_optional_email(text, text);

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ========================================
-- PARTE 1: LIMPIAR CONFIGURACIÓN ANTERIOR
-- ========================================

-- Deshabilitar RLS en todas las tablas (desarrollo)
ALTER TABLE public.restaurant_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_schedule_days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_closed_days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_combinations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_table_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_classification_history DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Allow all for config" ON public.restaurant_config;
DROP POLICY IF EXISTS "Allow all for schedules" ON public.restaurant_schedules;
DROP POLICY IF EXISTS "Allow all for special schedule days" ON public.special_schedule_days;
DROP POLICY IF EXISTS "Allow all for special closed days" ON public.special_closed_days;
DROP POLICY IF EXISTS "Allow all for tables" ON public.tables;
DROP POLICY IF EXISTS "Allow all for combinations" ON public.table_combinations;
DROP POLICY IF EXISTS "Allow all for time slots" ON public.time_slots;
DROP POLICY IF EXISTS "Allow all for customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all for reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow all for assignments" ON public.reservation_table_assignments;
DROP POLICY IF EXISTS "Allow all for classification history" ON public.customer_classification_history;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- ========================================
-- PARTE 2: CREAR USUARIO ADMINISTRADOR
-- ========================================

-- Crear usuario admin en auth.users
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '12345678-abcd-1234-abcd-123456789012',
    'authenticated',
    'authenticated',
    'admin@admin.es',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: "password"
    NOW(),
    NOW(),
    '',
    NOW(),
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Administrador Principal"}',
    false,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

-- Crear perfil de administrador
INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
VALUES (
    '12345678-abcd-1234-abcd-123456789012',
    'admin@admin.es',
    'Administrador Principal',
    'admin',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ========================================
-- PARTE 3: FUNCIONES DE GESTIÓN DE USUARIOS
-- ========================================

-- Función para obtener todos los usuarios (CORREGIDA con cast)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE(
    id uuid,
    email text,
    full_name text,
    role user_role,
    is_active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role::user_role,  -- CAST CORREGIDO: de text a user_role
        p.is_active,
        p.created_at,
        p.updated_at
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- Función para crear usuario
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_full_name text,
    p_role user_role DEFAULT 'user',
    p_password text DEFAULT 'password123'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_encrypted_password text;
BEGIN
    v_user_id := gen_random_uuid();
    v_encrypted_password := '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    
    -- Crear usuario en auth.users
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
        phone_change, phone_change_token, phone_change_sent_at,
        email_change_token_current, email_change_confirm_status, banned_until,
        reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        p_email, v_encrypted_password, NOW(), NOW(), '', NOW(), '', NULL, '', '', NULL, NULL,
        '{"provider": "email", "providers": ["email"]}', json_build_object('full_name', p_full_name),
        false, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL
    );
    
    -- Crear perfil
    INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
    VALUES (v_user_id, p_email, p_full_name, p_role, true, NOW(), NOW());

    RETURN json_build_object('success', true, 'user_id', v_user_id, 'message', 'Usuario creado correctamente');
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM);
END;
$$;

-- Función para actualizar usuario
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id uuid,
    p_email text,
    p_full_name text,
    p_role user_role,
    p_is_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE auth.users 
    SET email = p_email, raw_user_meta_data = json_build_object('full_name', p_full_name), updated_at = NOW()
    WHERE id = p_user_id;
    
    UPDATE public.profiles 
    SET email = p_email, full_name = p_full_name, role = p_role, is_active = p_is_active, updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN json_build_object('success', true, 'message', 'Usuario actualizado correctamente');
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Función para eliminar usuario
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id = '12345678-abcd-1234-abcd-123456789012' THEN
        RETURN json_build_object('success', false, 'error', 'No se puede eliminar el administrador principal');
    END IF;
    
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
    
    RETURN json_build_object('success', true, 'message', 'Usuario eliminado correctamente');
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ========================================
-- PARTE 4: FUNCIONES DE GESTIÓN DE RESERVAS
-- ========================================

-- Función para crear cliente si no existe
CREATE OR REPLACE FUNCTION public.create_customer_optional_email(
    p_name text,
    p_phone text,
    p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_existing_customer_id uuid;
BEGIN
    SELECT id INTO v_existing_customer_id
    FROM public.customers
    WHERE phone = p_phone OR (p_email IS NOT NULL AND email = p_email)
    LIMIT 1;
    
    IF v_existing_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET name = p_name,
            email = COALESCE(p_email, email),
            phone = p_phone,
            updated_at = now()
        WHERE id = v_existing_customer_id;
        RETURN v_existing_customer_id;
    ELSE
        INSERT INTO public.customers (name, phone, email)
        VALUES (p_name, p_phone, p_email)
        RETURNING id INTO v_customer_id;
        RETURN v_customer_id;
    END IF;
END;
$$;

-- Función principal para crear reserva desde admin
CREATE OR REPLACE FUNCTION public.admin_create_reservation(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text,
    p_table_ids uuid[] DEFAULT NULL,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_result json;
BEGIN
    -- Crear o actualizar cliente
    SELECT create_customer_optional_email(
        p_customer_name, 
        p_customer_phone, 
        NULLIF(p_customer_email, '')
    ) INTO v_customer_id;
    
    -- Crear reserva con asignación automática o específica
    IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
        -- Usar mesas específicas (si se implementa esta función)
        SELECT create_reservation_with_assignment(
            v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
        ) INTO v_result;
    ELSE
        -- Asignación automática
        SELECT create_reservation_with_assignment(
            v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
        ) INTO v_result;
    END IF;
    
    -- Agregar información del cliente al resultado
    IF (v_result->>'success')::boolean = true THEN
        v_result := v_result || json_build_object(
            'customer_id', v_customer_id, 
            'customer_name', p_customer_name
        );
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Error al crear la reserva: ' || SQLERRM
        );
END;
$$;

-- Función para obtener reservas con información completa
CREATE OR REPLACE FUNCTION public.admin_get_reservations(
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL,
    p_status text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    customer_email text,
    customer_classification customer_classification,
    reservation_date date,
    reservation_time time,
    guests integer,
    duration_minutes integer,
    special_requests text,
    status reservation_status,
    assigned_tables text[],
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id, r.customer_id, c.name, c.phone, c.email, c.classification,
        r.date, r.time, r.guests, r.duration_minutes, r.special_requests, r.status,
        ARRAY_AGG(t.name ORDER BY t.name), r.created_at, r.updated_at
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    LEFT JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
    LEFT JOIN public.tables t ON rta.table_id = t.id
    WHERE 
        (p_date_from IS NULL OR r.date >= p_date_from)
        AND (p_date_to IS NULL OR r.date <= p_date_to)
        AND (p_status IS NULL OR r.status::text = p_status)
    GROUP BY r.id, c.id
    ORDER BY r.date DESC, r.time DESC;
END;
$$;

-- Función para actualizar estado de reserva
CREATE OR REPLACE FUNCTION public.admin_update_reservation_status(
    p_reservation_id uuid,
    p_status reservation_status
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.reservations SET status = p_status, updated_at = NOW() WHERE id = p_reservation_id;
    
    IF FOUND THEN
        RETURN json_build_object('success', true, 'message', 'Estado actualizado correctamente');
    ELSE
        RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
END;
$$;

-- Función para cancelar reserva
CREATE OR REPLACE FUNCTION public.admin_cancel_reservation(p_reservation_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.reservations SET status = 'cancelled', updated_at = NOW() WHERE id = p_reservation_id;
    
    IF FOUND THEN
        RETURN json_build_object('success', true, 'message', 'Reserva cancelada correctamente');
    ELSE
        RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
END;
$$;

-- ========================================
-- PARTE 5: LIMPIAR CACHE Y FINALIZAR
-- ========================================

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Comentarios para documentación
COMMENT ON FUNCTION public.admin_get_users IS 'Obtiene lista de todos los usuarios del sistema (CORREGIDA con cast)';
COMMENT ON FUNCTION public.admin_create_user IS 'Crea un nuevo usuario en el sistema';
COMMENT ON FUNCTION public.admin_update_user IS 'Actualiza los datos de un usuario existente';
COMMENT ON FUNCTION public.admin_delete_user IS 'Elimina un usuario del sistema (excepto admin principal)';
COMMENT ON FUNCTION public.create_customer_optional_email IS 'Crea o actualiza un cliente con email opcional';
COMMENT ON FUNCTION public.admin_create_reservation IS 'Crea una nueva reserva desde el panel de administración';
COMMENT ON FUNCTION public.admin_get_reservations IS 'Obtiene lista de reservas con filtros opcionales';
COMMENT ON FUNCTION public.admin_update_reservation_status IS 'Actualiza el estado de una reserva';
COMMENT ON FUNCTION public.admin_cancel_reservation IS 'Cancela una reserva específica';

-- Verificación final
SELECT 'CONFIGURACIÓN VPS COMPLETADA - VERSIÓN CORREGIDA' as status, 
       'Sistema completamente funcional con todas las correcciones aplicadas' as mensaje,
       'Credenciales: admin@admin.es / password' as acceso,
       'Fix aplicado: admin_get_users con cast de role::user_role' as correccion,
       now() as timestamp;


-- ========================================
-- FINALIZACIÓN DE CONSOLIDACIÓN
-- ========================================

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Mensaje de confirmación
SELECT 
    'CONSOLIDACIÓN ORIGINAL COMPLETADA' as status,
    'Diseño original mantenido exactamente' as mensaje,
    'Sistema completo funcional' as resultado,
    NOW() as timestamp;

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================
-- 1. Ejecutar: psql -f CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql
-- 2. Credenciales: admin@admin.es / password
-- 3. Verificar que todo funciona correctamente
-- 4. El sistema mantiene el diseño original completo
