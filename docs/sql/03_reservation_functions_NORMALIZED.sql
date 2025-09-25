-- ========================================
-- FUNCIONES DE RESERVAS CON NORMALIZACIÓN A 15 MINUTOS
-- ========================================
-- Versión actualizada que incluye:
-- - Funciones originales corregidas
-- - Normalización automática a slots de 15 minutos
-- - API pública con gestión de clientes
-- - Sugerencias inteligentes de horarios

-- ========================================
-- LIMPIAR FUNCIONES EXISTENTES
-- ========================================
DROP FUNCTION IF EXISTS normalize_time_to_15min_slot(time);
DROP FUNCTION IF EXISTS get_suggested_time_slots(date, integer, time, integer, integer);
DROP FUNCTION IF EXISTS create_reservation_with_normalization(uuid, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS public_create_reservation_normalized(text, text, date, time, integer, text, text, integer);
DROP FUNCTION IF EXISTS admin_create_reservation(text, text, text, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS get_available_time_slots_15min(date, integer, integer);

-- ========================================
-- 1. FUNCIÓN DE NORMALIZACIÓN DE HORARIOS
-- ========================================
CREATE OR REPLACE FUNCTION normalize_time_to_15min_slot(input_time TIME)
RETURNS TIME
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    hour_part INTEGER;
    minute_part INTEGER;
    normalized_minutes INTEGER;
BEGIN
    hour_part := EXTRACT(HOUR FROM input_time);
    minute_part := EXTRACT(MINUTE FROM input_time);
    
    normalized_minutes := CASE
        WHEN minute_part < 8 THEN 0
        WHEN minute_part < 23 THEN 15
        WHEN minute_part < 38 THEN 30
        WHEN minute_part < 53 THEN 45
        ELSE 0
    END;
    
    IF minute_part >= 53 THEN
        hour_part := hour_part + 1;
        IF hour_part >= 24 THEN
            hour_part := 0;
        END IF;
    END IF;
    
    RETURN (hour_part || ':' || LPAD(normalized_minutes::text, 2, '0'))::TIME;
END;
$$;

-- ========================================
-- 2. FUNCIÓN PARA SLOTS SUGERIDOS (ANTERIOR Y POSTERIOR)
-- ========================================
CREATE OR REPLACE FUNCTION get_suggested_time_slots(
    p_date DATE,
    p_guests INTEGER,
    p_target_time TIME,
    p_duration_minutes INTEGER DEFAULT 120,
    p_limit INTEGER DEFAULT 2
)
RETURNS TABLE(suggested_time TIME, capacity INTEGER, position TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week INTEGER;
    v_schedule_record RECORD;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    SELECT rs.opening_time, rs.closing_time, rs.max_diners
    INTO v_schedule_record
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week 
      AND rs.is_active = true
    ORDER BY rs.opening_time
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Slot anterior
    RETURN QUERY
    SELECT 
        ts.time as suggested_time,
        LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, p_date, 
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) as capacity,
        'anterior'::TEXT as position
    FROM public.time_slots ts
    WHERE ts.time >= v_schedule_record.opening_time 
      AND ts.time < v_schedule_record.closing_time
      AND ts.time < p_target_time
      AND LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, p_date,
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) >= p_guests
    ORDER BY ts.time DESC
    LIMIT 1
    
    UNION ALL
    
    -- Slot posterior
    SELECT 
        ts.time as suggested_time,
        LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, p_date,
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) as capacity,
        'posterior'::TEXT as position
    FROM public.time_slots ts
    WHERE ts.time >= v_schedule_record.opening_time 
      AND ts.time < v_schedule_record.closing_time
      AND ts.time > p_target_time
      AND LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, p_date,
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) >= p_guests
    ORDER BY ts.time ASC
    LIMIT 1;
END;
$$;

-- ========================================
-- 3. ADMIN CREATE RESERVATION CON NORMALIZACIÓN
-- ========================================
CREATE OR REPLACE FUNCTION public.admin_create_reservation(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_notes text DEFAULT NULL,
    p_duration_minutes integer DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_normalized_time TIME;
    v_availability_check JSON;
    v_suggested_slots JSON;
    v_reservation_result JSON;
    v_customer_result JSON;
BEGIN
    v_normalized_time := normalize_time_to_15min_slot(p_time);
    
    SELECT json_build_object('success', true, 'customer_id', id) INTO v_customer_result
    FROM public.customers WHERE phone = p_customer_phone LIMIT 1;
    
    IF v_customer_result IS NULL THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (p_customer_name, p_customer_phone, NULLIF(p_customer_email, ''))
        RETURNING id INTO v_customer_id;
    ELSE
        v_customer_id := (v_customer_result->>'customer_id')::UUID;
        UPDATE public.customers 
        SET name = p_customer_name, email = COALESCE(NULLIF(p_customer_email, ''), email), updated_at = now()
        WHERE id = v_customer_id;
    END IF;
    
    SELECT json_build_object('available', CASE WHEN COUNT(*) > 0 THEN true ELSE false END, 'capacity', COALESCE(MAX(capacity), 0)) INTO v_availability_check
    FROM get_available_time_slots(p_date, p_guests, p_duration_minutes) 
    WHERE slot_time = v_normalized_time;
    
    IF NOT (v_availability_check->>'available')::boolean THEN
        SELECT json_agg(json_build_object('time', suggested_time::text, 'capacity', capacity, 'position', position)) INTO v_suggested_slots
        FROM get_suggested_time_slots(p_date, p_guests, v_normalized_time, p_duration_minutes, 2);
        
        RETURN json_build_object(
            'success', false,
            'error', 'La hora solicitada no está disponible',
            'original_time', p_time::text,
            'normalized_time', v_normalized_time::text,
            'suggested_times', COALESCE(v_suggested_slots, '[]'::json)
        );
    END IF;
    
    SELECT create_reservation_with_assignment(v_customer_id, p_date, v_normalized_time, p_guests, p_notes, p_duration_minutes) INTO v_reservation_result;
    
    IF (v_reservation_result->>'success')::boolean THEN
        RETURN json_build_object(
            'success', true,
            'reservation', v_reservation_result->'reservation',
            'customer', json_build_object('id', v_customer_id, 'name', p_customer_name, 'phone', p_customer_phone, 'email', p_customer_email),
            'original_time', p_time::text,
            'normalized_time', v_normalized_time::text,
            'message', CASE 
                WHEN p_time = v_normalized_time THEN 'Reserva creada exitosamente'
                ELSE 'Reserva creada exitosamente (hora ajustada a ' || v_normalized_time || ')'
            END
        );
    ELSE
        RETURN v_reservation_result;
    END IF;
END;
$$;

-- ========================================
-- 4. API PÚBLICA CON NORMALIZACIÓN
-- ========================================
CREATE OR REPLACE FUNCTION public_create_reservation_normalized(
    p_name TEXT,
    p_phone TEXT,
    p_date DATE,
    p_time TIME,
    p_guests INTEGER,
    p_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_customer_result JSON;
    v_reservation_result JSON;
    v_normalized_time TIME;
    v_availability_check JSON;
    v_suggested_slots JSON;
BEGIN
    v_normalized_time := normalize_time_to_15min_slot(p_time);
    
    SELECT json_build_object('success', true, 'customer_id', id) INTO v_customer_result
    FROM public.customers WHERE phone = p_phone LIMIT 1;
    
    IF v_customer_result IS NULL THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (p_name, p_phone, NULLIF(p_email, ''))
        RETURNING id INTO v_customer_id;
    ELSE
        v_customer_id := (v_customer_result->>'customer_id')::UUID;
        UPDATE public.customers 
        SET name = p_name, email = COALESCE(NULLIF(p_email, ''), email), updated_at = now()
        WHERE id = v_customer_id;
    END IF;
    
    SELECT json_build_object('available', CASE WHEN COUNT(*) > 0 THEN true ELSE false END, 'capacity', COALESCE(MAX(capacity), 0)) INTO v_availability_check
    FROM get_available_time_slots(p_date, p_guests, p_duration_minutes) 
    WHERE slot_time = v_normalized_time;
    
    IF NOT (v_availability_check->>'available')::boolean THEN
        SELECT json_agg(json_build_object('time', suggested_time::text, 'capacity', capacity, 'position', position)) INTO v_suggested_slots
        FROM get_suggested_time_slots(p_date, p_guests, v_normalized_time, p_duration_minutes, 2);
        
        RETURN json_build_object(
            'success', false,
            'error', 'La hora solicitada no está disponible',
            'original_time', p_time::text,
            'normalized_time', v_normalized_time::text,
            'suggested_times', COALESCE(v_suggested_slots, '[]'::json)
        );
    END IF;
    
    SELECT create_reservation_with_assignment(v_customer_id, p_date, v_normalized_time, p_guests, p_notes, p_duration_minutes) INTO v_reservation_result;
    
    IF (v_reservation_result->>'success')::boolean THEN
        RETURN json_build_object(
            'success', true,
            'reservation', v_reservation_result->'reservation',
            'customer', json_build_object('id', v_customer_id, 'name', p_name, 'phone', p_phone, 'email', p_email),
            'original_time', p_time::text,
            'normalized_time', v_normalized_time::text,
            'message', CASE 
                WHEN p_time = v_normalized_time THEN 'Reserva creada exitosamente'
                ELSE 'Reserva creada exitosamente (hora ajustada a ' || v_normalized_time || ')'
            END
        );
    ELSE
        RETURN v_reservation_result;
    END IF;
END;
$$;

-- ========================================
-- 5. ACTUALIZAR API PÚBLICA EXISTENTE
-- ========================================
CREATE OR REPLACE FUNCTION public_create_reservation(
    p_name TEXT,
    p_phone TEXT,
    p_date DATE,
    p_time TIME,
    p_guests INTEGER,
    p_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public_create_reservation_normalized(p_name, p_phone, p_date, p_time, p_guests, p_email, p_notes, p_duration_minutes);
END;
$$;

-- ========================================
-- 6. FUNCIÓN PARA OBTENER SLOTS DE 15 MINUTOS
-- ========================================
CREATE OR REPLACE FUNCTION get_available_time_slots_15min(
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
    v_schedule_record record;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    SELECT COUNT(*) > 0 INTO v_special_closed
    FROM public.special_closed_days scd
    WHERE ((NOT scd.is_range AND scd.date = p_date) OR (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end));

    IF v_special_closed THEN RETURN; END IF;

    SELECT rs.opening_time, rs.closing_time, rs.max_diners INTO v_schedule_record
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
    ORDER BY rs.opening_time LIMIT 1;

    IF NOT FOUND THEN RETURN; END IF;

    RETURN QUERY
    SELECT 
        ts.id,
        ts.time as slot_time,
        LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, p_date,
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) as capacity
    FROM public.time_slots ts
    WHERE ts.time >= v_schedule_record.opening_time 
      AND ts.time < v_schedule_record.closing_time
      AND LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, p_date,
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) >= p_guests
    ORDER BY ts.time LIMIT 100;
END;
$$;

-- ========================================
-- COMENTARIOS
-- ========================================
COMMENT ON FUNCTION normalize_time_to_15min_slot IS 'Normaliza cualquier hora al slot de 15 minutos más cercano';
COMMENT ON FUNCTION get_suggested_time_slots IS 'Obtiene 2 slots alternativos (anterior y posterior) al horario solicitado';
COMMENT ON FUNCTION admin_create_reservation(text, text, text, date, time, integer, text, integer) IS 'Crea reserva desde admin con normalización automática a slots de 15 min';
COMMENT ON FUNCTION public_create_reservation_normalized IS 'API pública para crear reservas con normalización automática';
COMMENT ON FUNCTION get_available_time_slots_15min IS 'Obtiene slots disponibles normalizados a 15 minutos';
