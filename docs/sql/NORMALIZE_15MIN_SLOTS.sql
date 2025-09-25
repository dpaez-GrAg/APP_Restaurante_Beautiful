-- ========================================
-- NORMALIZACIÓN A SLOTS DE 15 MINUTOS
-- ========================================
-- Este script actualiza el sistema para trabajar únicamente con slots de 15 minutos
-- Incluye función de normalización automática y manejo de errores con sugerencias

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
    -- Extraer hora y minutos
    hour_part := EXTRACT(HOUR FROM input_time);
    minute_part := EXTRACT(MINUTE FROM input_time);
    
    -- Normalizar minutos al slot de 15 min más cercano
    normalized_minutes := CASE
        WHEN minute_part < 8 THEN 0      -- 0-7 → 0
        WHEN minute_part < 23 THEN 15    -- 8-22 → 15
        WHEN minute_part < 38 THEN 30    -- 23-37 → 30
        WHEN minute_part < 53 THEN 45    -- 38-52 → 45
        ELSE 0                           -- 53-59 → siguiente hora
    END;
    
    -- Si los minutos se redondean a la siguiente hora
    IF minute_part >= 53 THEN
        hour_part := hour_part + 1;
        -- Manejar el caso de medianoche
        IF hour_part >= 24 THEN
            hour_part := 0;
        END IF;
    END IF;
    
    RETURN (hour_part || ':' || LPAD(normalized_minutes::text, 2, '0'))::TIME;
END;
$$;

-- ========================================
-- 2. FUNCIÓN PARA OBTENER SLOTS SUGERIDOS
-- ========================================

CREATE OR REPLACE FUNCTION get_suggested_time_slots(
    p_date DATE,
    p_guests INTEGER,
    p_target_time TIME,
    p_duration_minutes INTEGER DEFAULT 120,
    p_limit INTEGER DEFAULT 3
)
RETURNS TABLE(suggested_time TIME, capacity INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week INTEGER;
    v_schedule_record RECORD;
BEGIN
    -- Obtener día de la semana y horario
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    SELECT rs.opening_time, rs.closing_time, rs.max_diners
    INTO v_schedule_record
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week 
      AND rs.is_active = true
    ORDER BY rs.opening_time
    LIMIT 1;
    
    -- Si no hay horario configurado, salir
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Buscar slots disponibles cerca del horario solicitado
    RETURN QUERY
    SELECT 
        ts.time as suggested_time,
        LEAST(
            COALESCE((
                SELECT SUM(t.capacity + COALESCE(t.extra_capacity, 0))::integer
                FROM public.tables t
                WHERE t.is_active = true
                  AND is_table_available(
                    t.id, 
                    p_date, 
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
                    t.id, 
                    p_date, 
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'),
                    ((p_date::text || ' ' || ts.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval
                  )
            ), 0),
            ts.max_capacity
        ) >= p_guests
    ORDER BY ABS(EXTRACT(EPOCH FROM (ts.time - p_target_time))) -- Ordenar por proximidad al horario solicitado
    LIMIT p_limit;
END;
$$;

-- ========================================
-- 3. ACTUALIZAR TABLA TIME_SLOTS CON SLOTS DE 15 MINUTOS
-- ========================================

-- Limpiar slots existentes
DELETE FROM public.time_slots;

-- Insertar slots de 15 minutos para servicio de comida (12:00 - 17:00)
INSERT INTO public.time_slots (time, max_capacity) VALUES
-- 12:00 - 13:00
('12:00', 40), ('12:15', 40), ('12:30', 40), ('12:45', 40),
-- 13:00 - 14:00 (hora pico)
('13:00', 50), ('13:15', 50), ('13:30', 50), ('13:45', 50),
-- 14:00 - 15:00
('14:00', 45), ('14:15', 45), ('14:30', 45), ('14:45', 45),
-- 15:00 - 16:00
('15:00', 35), ('15:15', 35), ('15:30', 35), ('15:45', 35),
-- 16:00 - 17:00
('16:00', 30), ('16:15', 30), ('16:30', 25), ('16:45', 25);

-- Insertar slots de 15 minutos para servicio de cena (19:00 - 24:00)
INSERT INTO public.time_slots (time, max_capacity) VALUES
-- 19:00 - 20:00
('19:00', 30), ('19:15', 35), ('19:30', 40), ('19:45', 40),
-- 20:00 - 21:00 (hora pico)
('20:00', 50), ('20:15', 50), ('20:30', 50), ('20:45', 50),
-- 21:00 - 22:00
('21:00', 45), ('21:15', 45), ('21:30', 45), ('21:45', 45),
-- 22:00 - 23:00
('22:00', 40), ('22:15', 40), ('22:30', 35), ('22:45', 35),
-- 23:00 - 24:00
('23:00', 30), ('23:15', 25), ('23:30', 25), ('23:45', 20);

-- ========================================
-- 4. FUNCIÓN DE CREACIÓN DE RESERVA CON NORMALIZACIÓN
-- ========================================

CREATE OR REPLACE FUNCTION create_reservation_with_normalization(
    p_customer_id UUID,
    p_date DATE,
    p_time TIME,
    p_guests INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_normalized_time TIME;
    v_availability_check JSON;
    v_suggested_slots JSON;
    v_reservation_result JSON;
BEGIN
    -- 1. Normalizar la hora solicitada
    v_normalized_time := normalize_time_to_15min_slot(p_time);
    
    -- 2. Verificar disponibilidad en el slot normalizado
    SELECT json_build_object(
        'available', CASE WHEN COUNT(*) > 0 THEN true ELSE false END,
        'capacity', COALESCE(MAX(capacity), 0)
    ) INTO v_availability_check
    FROM get_available_time_slots(p_date, p_guests, p_duration_minutes) 
    WHERE slot_time = v_normalized_time;
    
    -- 3. Si no está disponible, devolver error con sugerencias
    IF NOT (v_availability_check->>'available')::boolean THEN
        -- Obtener slots sugeridos
        SELECT json_agg(
            json_build_object(
                'time', suggested_time::text,
                'capacity', capacity
            )
        ) INTO v_suggested_slots
        FROM get_suggested_time_slots(p_date, p_guests, v_normalized_time, p_duration_minutes, 3);
        
        RETURN json_build_object(
            'success', false,
            'error', 'La hora solicitada no está disponible',
            'original_time', p_time::text,
            'normalized_time', v_normalized_time::text,
            'suggested_times', COALESCE(v_suggested_slots, '[]'::json)
        );
    END IF;
    
    -- 4. Crear la reserva con la hora normalizada
    SELECT create_reservation_with_assignment(
        p_customer_id,
        p_date,
        v_normalized_time,
        p_guests,
        p_notes,
        p_duration_minutes
    ) INTO v_reservation_result;
    
    -- 5. Agregar información de normalización al resultado
    IF (v_reservation_result->>'success')::boolean THEN
        RETURN json_build_object(
            'success', true,
            'reservation', v_reservation_result->'reservation',
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
-- 5. FUNCIÓN PARA API PÚBLICA CON NORMALIZACIÓN
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
BEGIN
    -- 1. Crear o actualizar cliente
    SELECT json_build_object(
        'success', true,
        'customer_id', id
    ) INTO v_customer_result
    FROM public.customers
    WHERE phone = p_phone
    LIMIT 1;
    
    IF v_customer_result IS NULL THEN
        -- Crear nuevo cliente
        INSERT INTO public.customers (name, phone, email)
        VALUES (p_name, p_phone, NULLIF(p_email, ''))
        RETURNING id INTO v_customer_id;
    ELSE
        v_customer_id := (v_customer_result->>'customer_id')::UUID;
        
        -- Actualizar información del cliente existente
        UPDATE public.customers 
        SET 
            name = p_name,
            email = COALESCE(NULLIF(p_email, ''), email),
            updated_at = now()
        WHERE id = v_customer_id;
    END IF;
    
    -- 2. Crear reserva con normalización
    SELECT create_reservation_with_normalization(
        v_customer_id,
        p_date,
        p_time,
        p_guests,
        p_notes,
        p_duration_minutes
    ) INTO v_reservation_result;
    
    -- 3. Agregar información del cliente al resultado
    IF (v_reservation_result->>'success')::boolean THEN
        RETURN json_build_object(
            'success', true,
            'reservation', v_reservation_result->'reservation',
            'customer', json_build_object(
                'id', v_customer_id,
                'name', p_name,
                'phone', p_phone,
                'email', p_email
            ),
            'original_time', v_reservation_result->>'original_time',
            'normalized_time', v_reservation_result->>'normalized_time',
            'message', v_reservation_result->>'message'
        );
    ELSE
        RETURN v_reservation_result;
    END IF;
END;
$$;

-- ========================================
-- 6. COMENTARIOS Y DOCUMENTACIÓN
-- ========================================

COMMENT ON FUNCTION normalize_time_to_15min_slot IS 'Normaliza cualquier hora al slot de 15 minutos más cercano';
COMMENT ON FUNCTION get_suggested_time_slots IS 'Obtiene slots alternativos ordenados por proximidad al horario solicitado';
COMMENT ON FUNCTION create_reservation_with_normalization IS 'Crea reserva con normalización automática de horario';
COMMENT ON FUNCTION public_create_reservation_normalized IS 'API pública para crear reservas con normalización automática';

-- ========================================
-- 7. EJEMPLOS DE USO
-- ========================================

/*
-- Ejemplo 1: Normalizar hora
SELECT normalize_time_to_15min_slot('14:23'::TIME); -- Resultado: 14:30

-- Ejemplo 2: Crear reserva con normalización
SELECT create_reservation_with_normalization(
    'customer-uuid'::UUID,
    '2025-01-15'::DATE,
    '14:23'::TIME,  -- Se normalizará a 14:30
    4,
    'Mesa junto a la ventana',
    120
);

-- Ejemplo 3: API pública con normalización
SELECT public_create_reservation_normalized(
    'Juan Pérez',
    '+34666777888',
    'juan@email.com',
    '2025-01-15'::DATE,
    '20:37'::TIME,  -- Se normalizará a 20:45
    2,
    'Cena romántica',
    90
);
*/
