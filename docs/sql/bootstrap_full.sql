-- ========================================
-- RESTAURANT RESERVATION SYSTEM - COMPLETE DATABASE BOOTSTRAP
-- ========================================
-- This file contains all necessary SQL to create the complete database schema
-- Execute this file to set up the entire database from scratch
-- Version: 2.0
-- Last updated: 2025-01-07

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ========================================
-- ENUM TYPES
-- ========================================

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- DROP EXISTING FUNCTIONS (for idempotency)
-- ========================================

DROP FUNCTION IF EXISTS public.get_available_time_slots(date, integer, integer);
DROP FUNCTION IF EXISTS public.create_reservation_with_assignment(uuid, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS public.create_reservation_with_specific_tables(uuid, date, time, integer, text, uuid[], integer);
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, date, time, integer, text, text, uuid[], integer);
DROP FUNCTION IF EXISTS public.move_reservation_with_validation(uuid, date, time, integer, uuid[]);
DROP FUNCTION IF EXISTS public.update_reservation_details(uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.update_reservation_guests_with_reassignment(uuid, integer);
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ========================================
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
-- STORED PROCEDURES (RPC FUNCTIONS)
-- ========================================

-- Get available time slots for a specific date and guest count
CREATE OR REPLACE FUNCTION public.get_available_time_slots(
    p_date DATE, 
    p_guests INTEGER, 
    p_duration_minutes INTEGER DEFAULT 90
)
RETURNS TABLE(id UUID, slot_time TIME WITHOUT TIME ZONE, capacity INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_day_of_week integer;
  v_special_closed boolean;
  v_opening time without time zone;
  v_closing time without time zone;
  rec record;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_available_capacity integer;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days scd
  WHERE (
    (NOT scd.is_range AND scd.date = p_date) OR
    (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
  );

  IF v_special_closed THEN
    RETURN;
  END IF;

  SELECT ssd.opening_time, ssd.closing_time
  INTO v_opening, v_closing
  FROM public.special_schedule_days ssd
  WHERE ssd.date = p_date AND ssd.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT rs.opening_time, rs.closing_time
    INTO v_opening, v_closing
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  FOR rec IN
    SELECT ts.id, ts.time, ts.max_capacity
    FROM public.time_slots ts
    WHERE ts.time >= v_opening AND ts.time < v_closing
    ORDER BY ts.time
  LOOP
    v_start_at := ((p_date::text || ' ' || rec.time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_available_capacity
    FROM public.tables t
    WHERE t.is_active = true
      AND t.id NOT IN (
        SELECT rta.table_id
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE r.date = p_date
          AND r.status <> 'cancelled'
          AND (
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') <= v_start_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at)
            OR
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) >= v_end_at)
            OR
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') >= v_start_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) <= v_end_at)
          )
      );

    IF LEAST(v_available_capacity, rec.max_capacity) >= p_guests THEN
      id := rec.id;
      slot_time := rec.time;
      capacity := LEAST(v_available_capacity, rec.max_capacity);
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;

-- Create reservation with automatic table assignment
CREATE OR REPLACE FUNCTION public.create_reservation_with_assignment(
    p_customer_id UUID, 
    p_date DATE, 
    p_time TIME WITHOUT TIME ZONE, 
    p_guests INTEGER, 
    p_special_requests TEXT DEFAULT NULL, 
    p_duration_minutes INTEGER DEFAULT 90
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
BEGIN
  v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days 
  WHERE (
    (NOT is_range AND date = p_date) OR
    (is_range AND p_date BETWEEN range_start AND range_end)
  );
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;

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

  v_needed_capacity := p_guests;
  v_assigned_tables := ARRAY[]::UUID[];
  v_current_capacity := 0;

  -- Try to find a single table with sufficient capacity
  SELECT t.id
  INTO v_table_record
  FROM public.tables t
  WHERE t.is_active = true
    AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
    AND t.id NOT IN (
      SELECT rta.table_id
      FROM public.reservation_table_assignments rta
      JOIN public.reservations r ON rta.reservation_id = r.id
      WHERE r.date = p_date
        AND r.status != 'cancelled'
        AND (
          ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
          AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
               + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
        )
    )
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
  LIMIT 1;

  IF FOUND THEN
    v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
    SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
    FROM public.tables t WHERE t.id = v_table_record.id;
  ELSE
    -- Try table combinations
    FOR v_combination IN
      SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
      FROM public.table_combinations tc
      WHERE tc.is_active = true
        AND p_guests >= COALESCE(tc.min_capacity, 1)
        AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
        AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
      ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE rta.table_id = ANY(v_combination.table_ids)
          AND r.date = p_date
          AND r.status != 'cancelled'
          AND (
            ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
            AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                 + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
          )
      ) THEN
        v_assigned_tables := v_combination.table_ids;
        v_current_capacity := v_combination.effective_capacity;
        EXIT;
      END IF;
    END LOOP;

    IF array_length(v_assigned_tables, 1) = 0 OR v_assigned_tables IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'No hay mesas individuales ni combinaciones disponibles para esta capacidad');
    END IF;
  END IF;

  IF v_current_capacity < v_needed_capacity THEN
    RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
  END IF;

  INSERT INTO public.reservations (
    customer_id, date, time, guests, special_requests, 
    status, duration_minutes, start_at, end_at
  )
  VALUES (
    p_customer_id, p_date, p_time, p_guests, p_special_requests, 
    'confirmed', p_duration_minutes, v_start_at, v_end_at
  )
  RETURNING id INTO v_reservation_id;

  FOR i IN 1..array_length(v_assigned_tables, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (v_reservation_id, v_assigned_tables[i]);
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'reservation_id', v_reservation_id,
    'assigned_tables', v_assigned_tables
  );
END;
$function$;

-- Create reservation with specific tables
CREATE OR REPLACE FUNCTION public.create_reservation_with_specific_tables(
    p_customer_id UUID, 
    p_date DATE, 
    p_time TIME WITHOUT TIME ZONE, 
    p_guests INTEGER, 
    p_special_requests TEXT DEFAULT NULL, 
    p_table_ids UUID[] DEFAULT NULL, 
    p_duration_minutes INTEGER DEFAULT 90
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_reservation_id UUID;
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_current_capacity INTEGER;
  v_day_of_week INTEGER;
  v_schedule_exists BOOLEAN;
  v_special_closed BOOLEAN;
  v_special_schedule RECORD;
BEGIN
  v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days 
  WHERE (
    (NOT is_range AND date = p_date) OR
    (is_range AND p_date BETWEEN range_start AND range_end)
  );
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;

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

  SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_current_capacity
  FROM public.tables t
  WHERE t.id = ANY(p_table_ids) AND t.is_active = true;

  IF v_current_capacity < p_guests THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reservation_table_assignments rta
    JOIN public.reservations r ON rta.reservation_id = r.id
    WHERE rta.table_id = ANY(p_table_ids)
      AND r.date = p_date
      AND r.status != 'cancelled'
      AND (
        ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
        AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
             + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
      )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables are not available at this time');
  END IF;

  INSERT INTO public.reservations (
    customer_id, date, time, guests, special_requests, 
    status, duration_minutes, start_at, end_at
  )
  VALUES (
    p_customer_id, p_date, p_time, p_guests, p_special_requests, 
    'confirmed', p_duration_minutes, v_start_at, v_end_at
  )
  RETURNING id INTO v_reservation_id;

  FOR i IN 1..array_length(p_table_ids, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (v_reservation_id, p_table_ids[i]);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'assigned_tables', p_table_ids
  );
END;
$function$;

-- Admin create reservation (creates customer if needed)
CREATE OR REPLACE FUNCTION public.admin_create_reservation(
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_date DATE,
    p_time TIME WITHOUT TIME ZONE,
    p_guests INTEGER,
    p_customer_phone TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_table_ids UUID[] DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 90
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_reservation_result JSON;
BEGIN
  INSERT INTO public.customers (name, email, phone)
  VALUES (p_customer_name, p_customer_email, p_customer_phone)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    updated_at = now()
  RETURNING id INTO v_customer_id;
  
  IF p_table_ids IS NOT NULL THEN
    SELECT public.create_reservation_with_specific_tables(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_table_ids, p_duration_minutes
    ) INTO v_reservation_result;
  ELSE
    SELECT public.create_reservation_with_assignment(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
    ) INTO v_reservation_result;
  END IF;
  
  RETURN v_reservation_result;
END;
$function$;

-- Update reservation details
CREATE OR REPLACE FUNCTION public.update_reservation_details(
    p_reservation_id UUID,
    p_guests INTEGER DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_current_capacity INTEGER;
  v_assigned_tables UUID[];
BEGIN
  IF p_guests IS NOT NULL THEN
    SELECT array_agg(rta.table_id) INTO v_assigned_tables
    FROM public.reservation_table_assignments rta
    WHERE rta.reservation_id = p_reservation_id;
    
    SELECT COALESCE(SUM(t.capacity), 0) INTO v_current_capacity
    FROM public.tables t
    WHERE t.id = ANY(v_assigned_tables) AND t.is_active = true;
    
    IF v_current_capacity < p_guests THEN
      RETURN json_build_object('success', false, 'error', 'Current table assignment does not have enough capacity for the new guest count');
    END IF;
  END IF;
  
  UPDATE public.reservations
  SET 
    guests = COALESCE(p_guests, guests),
    special_requests = COALESCE(p_special_requests, special_requests),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;
  
  RETURN json_build_object('success', true, 'reservation_id', p_reservation_id);
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_available_time_slots(DATE, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_reservation_with_assignment(UUID, DATE, TIME, INTEGER, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_reservation_with_specific_tables(UUID, DATE, TIME, INTEGER, TEXT, UUID[], INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_reservation(TEXT, TEXT, DATE, TIME, INTEGER, TEXT, TEXT, UUID[], INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_reservation_details(UUID, INTEGER, TEXT, TEXT) TO anon, authenticated;

-- ========================================
-- FINAL NOTES
-- ========================================

-- Database bootstrap completed successfully
-- Next step: Run seed_full.sql to populate with example data
-- Make sure to configure your environment variables properly
-- Test the RPC functions with sample data to ensure everything works correctly