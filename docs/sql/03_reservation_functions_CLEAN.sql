-- ========================================
-- FUNCIONES DE RESERVAS - VERSIÓN LIMPIA
-- Solo incluye funciones que se usan en producción
-- ========================================

-- ========================================
-- FUNCIÓN 1: VERIFICAR DISPONIBILIDAD DE MESA
-- ========================================
CREATE OR REPLACE FUNCTION is_table_available(
    p_table_id uuid,
    p_date date,
    p_start_at timestamptz,
    p_end_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM public.reservations r
        INNER JOIN public.table_assignments ta ON r.id = ta.reservation_id
        WHERE ta.table_id = p_table_id
          AND r.date = p_date
          AND r.status IN ('confirmed', 'arrived')
          AND (
              (r.start_at < p_end_at AND r.end_at > p_start_at)
          )
    );
END;
$$;

-- ========================================
-- FUNCIÓN 2: CALCULAR OCUPACIÓN DE UN SLOT
-- ========================================
CREATE OR REPLACE FUNCTION public.calculate_slot_occupation(
    p_date DATE,
    p_slot_time TIME,
    p_schedule_start TIME,
    p_schedule_end TIME,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_occupation INTEGER;
BEGIN
    SELECT COALESCE(SUM(r.guests), 0)
    INTO v_occupation
    FROM public.reservations r
    WHERE r.date = p_date
      AND r.status IN ('confirmed', 'arrived')
      AND r.time >= p_schedule_start
      AND r.time < p_schedule_end
      AND r.time <= p_slot_time
      AND (r.time + (r.duration_minutes || ' minutes')::interval)::time > p_slot_time
      AND (p_exclude_reservation_id IS NULL OR r.id != p_exclude_reservation_id);
    
    RETURN v_occupation;
END;
$$;

-- ========================================
-- FUNCIÓN 3: DETERMINAR TIPO DE HORARIO
-- ========================================
CREATE OR REPLACE FUNCTION public.get_schedule_type(
    p_day_of_week INTEGER,
    p_time TIME
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count INTEGER;
    v_opening TIME;
    v_index INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.restaurant_schedules
    WHERE day_of_week = p_day_of_week AND is_active = true;
    
    IF v_count = 1 THEN RETURN 'single'; END IF;
    
    SELECT opening_time INTO v_opening
    FROM public.restaurant_schedules
    WHERE day_of_week = p_day_of_week AND is_active = true
      AND p_time >= opening_time AND p_time < closing_time
    ORDER BY opening_time LIMIT 1;
    
    IF NOT FOUND THEN RETURN 'single'; END IF;
    
    SELECT COUNT(*) INTO v_index
    FROM public.restaurant_schedules
    WHERE day_of_week = p_day_of_week AND is_active = true
      AND opening_time < v_opening;
    
    RETURN CASE WHEN v_index = 0 THEN 'morning' ELSE 'afternoon' END;
END;
$$;

-- ========================================
-- FUNCIÓN 4: SLOTS DISPONIBLES NORMALIZADOS (OPTIMIZADA)
-- Esta es la función que usa el frontend
-- ========================================
DROP FUNCTION IF EXISTS public.get_available_time_slots_normalized(date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_available_time_slots_normalized(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 90
)
RETURNS TABLE(id uuid, slot_time time, capacity integer, is_normalized boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week integer;
    v_special_closed boolean;
    v_total_capacity integer;
BEGIN
    -- Obtener día de la semana
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Verificar si es un día especial cerrado
    SELECT COUNT(*) > 0 INTO v_special_closed
    FROM public.special_closed_days scd
    WHERE (
        (NOT scd.is_range AND scd.date = p_date) OR
        (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
    );

    -- Si está cerrado, no devolver slots
    IF v_special_closed THEN
        RETURN;
    END IF;

    -- Calcular capacidad total del restaurante
    SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0)
    INTO v_total_capacity
    FROM public.tables t
    WHERE t.is_active = true;

    -- Si no hay capacidad suficiente en todo el restaurante, no devolver slots
    IF v_total_capacity < p_guests THEN
        RETURN;
    END IF;

    -- Devolver slots donde se puede asignar una mesa o combinación
    -- Respetando el orden de prioridad de zonas
    -- OPTIMIZADO: Calcula todas las mesas ocupadas de una vez (sin timeout)
    RETURN QUERY
    WITH slot_times AS (
        SELECT ts.time as slot_time
        FROM public.time_slots ts
        WHERE EXISTS (
            SELECT 1 FROM public.restaurant_schedules rs
            WHERE rs.day_of_week = v_day_of_week 
              AND rs.is_active = true
              AND ts.time >= rs.opening_time 
              AND ts.time < rs.closing_time
        )
    ),
    slot_ranges AS (
        SELECT 
            st.slot_time,
            ((p_date::text || ' ' || st.slot_time::text)::timestamp AT TIME ZONE 'Europe/Madrid') as start_at,
            ((p_date::text || ' ' || st.slot_time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval as end_at
        FROM slot_times st
    ),
    -- Obtener TODAS las mesas ocupadas para TODOS los slots de una vez
    occupied_tables AS (
        SELECT DISTINCT
            sr.slot_time,
            rta.table_id
        FROM slot_ranges sr
        CROSS JOIN public.reservations r
        INNER JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
        WHERE r.date = p_date
          AND r.status IN ('confirmed', 'arrived')
          AND r.start_at < sr.end_at 
          AND r.end_at > sr.start_at
    ),
    -- Mesas individuales disponibles (con prioridad de zona)
    single_tables_available AS (
        SELECT 
            sr.slot_time,
            t.id as table_id,
            (t.capacity + COALESCE(t.extra_capacity, 0)) as table_capacity,
            COALESCE(z.priority_order, 999) as zone_priority
        FROM slot_ranges sr
        CROSS JOIN public.tables t
        LEFT JOIN public.zones z ON t.zone_id = z.id
        WHERE t.is_active = true
          AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= p_guests
          AND NOT EXISTS (
              SELECT 1 FROM occupied_tables ot
              WHERE ot.slot_time = sr.slot_time
                AND ot.table_id = t.id
          )
    ),
    -- Combinaciones disponibles (con prioridad de zona)
    combinations_available AS (
        SELECT 
            sr.slot_time,
            tc.id as combination_id,
            (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) as combination_capacity,
            COALESCE(z.priority_order, 999) as zone_priority
        FROM slot_ranges sr
        CROSS JOIN public.table_combinations tc
        LEFT JOIN public.zones z ON tc.zone_id = z.id
        WHERE tc.is_active = true
          AND p_guests >= COALESCE(tc.min_capacity, 1)
          AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
          AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
          -- CRÍTICO: Verificar que TODAS las mesas de la combinación están activas
          AND (
              SELECT bool_and(t.is_active)
              FROM unnest(tc.table_ids) AS tid
              JOIN public.tables t ON t.id = tid
          )
          -- Verificar que ninguna mesa está ocupada
          AND NOT EXISTS (
              SELECT 1 
              FROM unnest(tc.table_ids) AS tid
              WHERE EXISTS (
                  SELECT 1 FROM occupied_tables ot
                  WHERE ot.slot_time = sr.slot_time
                    AND ot.table_id = tid
              )
          )
    ),
    -- Unir mesas y combinaciones, ordenadas por prioridad de zona
    all_options_available AS (
        SELECT 
            sta.slot_time,
            sta.table_capacity as capacity,
            sta.zone_priority
        FROM single_tables_available sta
        UNION ALL
        SELECT 
            ca.slot_time,
            ca.combination_capacity as capacity,
            ca.zone_priority
        FROM combinations_available ca
    ),
    -- Para cada slot, obtener la mejor opción (menor prioridad de zona)
    best_option_per_slot AS (
        SELECT DISTINCT ON (aoa.slot_time)
            aoa.slot_time,
            aoa.capacity,
            aoa.zone_priority
        FROM all_options_available aoa
        ORDER BY aoa.slot_time, aoa.zone_priority ASC, aoa.capacity ASC
    )
    SELECT 
        gen_random_uuid() as id,
        bops.slot_time,
        bops.capacity::integer as capacity,
        true as is_normalized
    FROM best_option_per_slot bops
    ORDER BY bops.slot_time
    LIMIT 100;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.get_available_time_slots_normalized(date, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_time_slots_normalized(date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_time_slots_normalized(date, integer, integer) TO service_role;

-- ========================================
-- FUNCIÓN 5: OBTENER MESAS DISPONIBLES PARA RESERVA
-- ========================================
CREATE OR REPLACE FUNCTION get_available_tables_for_reservation(
    p_date date,
    p_time time,
    p_duration_minutes integer DEFAULT 90
)
RETURNS TABLE(
    table_id uuid,
    table_name text,
    capacity integer,
    extra_capacity integer,
    total_capacity integer,
    zone_id uuid,
    zone_name text,
    zone_color text,
    is_available boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_start_at timestamptz;
    v_end_at timestamptz;
BEGIN
    v_start_at := ((p_date::text || ' ' || p_time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    RETURN QUERY
    SELECT 
        t.id as table_id,
        t.name as table_name,
        t.capacity,
        COALESCE(t.extra_capacity, 0) as extra_capacity,
        (t.capacity + COALESCE(t.extra_capacity, 0)) as total_capacity,
        t.zone_id,
        z.name as zone_name,
        z.color as zone_color,
        is_table_available(t.id, p_date, v_start_at, v_end_at) as is_available
    FROM public.tables t
    LEFT JOIN public.zones z ON t.zone_id = z.id
    WHERE t.is_active = true
    ORDER BY z.priority_order NULLS LAST, t.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_tables_for_reservation(date, time, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_available_tables_for_reservation(date, time, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_tables_for_reservation(date, time, integer) TO service_role;

-- ========================================
-- FUNCIÓN 6: CREAR RESERVA CON ASIGNACIÓN AUTOMÁTICA
-- ========================================
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
    p_customer_id uuid,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text DEFAULT '',
    p_duration_minutes integer DEFAULT 90,
    p_preferred_zone_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id uuid;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_table record;
    v_total_capacity integer := 0;
    v_tables_assigned uuid[] := ARRAY[]::uuid[];
BEGIN
    v_start_at := ((p_date::text || ' ' || p_time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    -- Crear la reserva
    INSERT INTO public.reservations (
        customer_id, date, time, guests, status, 
        special_requests, duration_minutes, start_at, end_at
    )
    VALUES (
        p_customer_id, p_date, p_time, p_guests, 'confirmed',
        p_special_requests, p_duration_minutes, v_start_at, v_end_at
    )
    RETURNING id INTO v_reservation_id;

    -- Asignar mesas automáticamente
    FOR v_table IN
        SELECT t.id, t.capacity, COALESCE(t.extra_capacity, 0) as extra_capacity
        FROM public.tables t
        LEFT JOIN public.zones z ON t.zone_id = z.id
        WHERE t.is_active = true
          AND (p_preferred_zone_id IS NULL OR t.zone_id = p_preferred_zone_id)
          AND is_table_available(t.id, p_date, v_start_at, v_end_at)
        ORDER BY 
          CASE WHEN t.zone_id = p_preferred_zone_id THEN 0 ELSE 1 END,
          z.priority_order NULLS LAST,
          t.capacity + COALESCE(t.extra_capacity, 0)
    LOOP
        INSERT INTO public.table_assignments (reservation_id, table_id)
        VALUES (v_reservation_id, v_table.id);
        
        v_tables_assigned := array_append(v_tables_assigned, v_table.id);
        v_total_capacity := v_total_capacity + v_table.capacity + v_table.extra_capacity;
        
        IF v_total_capacity >= p_guests THEN
            EXIT;
        END IF;
    END LOOP;

    IF v_total_capacity < p_guests THEN
        RAISE EXCEPTION 'No hay mesas disponibles para esta capacidad';
    END IF;

    RETURN json_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'tables_assigned', v_tables_assigned
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION create_reservation_with_assignment TO anon;
GRANT EXECUTE ON FUNCTION create_reservation_with_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION create_reservation_with_assignment TO service_role;

-- ========================================
-- FUNCIÓN 7: CREAR CLIENTE (OPCIONAL EMAIL)
-- ========================================
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
    v_customer_id uuid;
BEGIN
    -- Buscar cliente existente por teléfono o email
    IF p_phone IS NOT NULL THEN
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE phone = p_phone
        LIMIT 1;
    END IF;

    IF v_customer_id IS NULL AND p_email IS NOT NULL THEN
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE email = p_email
        LIMIT 1;
    END IF;

    -- Si no existe, crear nuevo
    IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (p_name, p_phone, p_email)
        RETURNING id INTO v_customer_id;
    END IF;

    RETURN v_customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_customer_optional_email TO anon;
GRANT EXECUTE ON FUNCTION create_customer_optional_email TO authenticated;
GRANT EXECUTE ON FUNCTION create_customer_optional_email TO service_role;

-- ========================================
-- FUNCIÓN 8: ACTUALIZAR DETALLES DE RESERVA
-- ========================================
CREATE OR REPLACE FUNCTION update_reservation_details(
    p_reservation_id uuid,
    p_guests integer DEFAULT NULL,
    p_special_requests text DEFAULT NULL,
    p_status text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_updated_count INTEGER;
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
    
    -- Validar número de comensales
    IF p_guests IS NOT NULL AND p_guests <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El número de comensales debe ser mayor a 0'
        );
    END IF;
    
    -- Actualizar
    UPDATE public.reservations
    SET 
        guests = CASE WHEN p_guests IS NOT NULL THEN p_guests ELSE guests END,
        special_requests = CASE WHEN p_special_requests IS NOT NULL THEN p_special_requests ELSE special_requests END,
        status = CASE WHEN p_status IS NOT NULL THEN p_status::reservation_status ELSE status END,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se pudo actualizar la reserva'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reserva actualizada exitosamente'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al actualizar la reserva: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION update_reservation_details TO authenticated;
GRANT EXECUTE ON FUNCTION update_reservation_details TO service_role;

-- ========================================
-- FUNCIÓN 9: MOVER RESERVA CON VALIDACIÓN
-- ========================================
CREATE OR REPLACE FUNCTION move_reservation_with_validation(
    p_reservation_id uuid,
    p_new_date date,
    p_new_time time,
    p_duration_minutes integer,
    p_new_table_ids uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_new_start_at timestamptz;
    v_new_end_at timestamptz;
    v_table_id uuid;
BEGIN
    -- Obtener reserva actual
    SELECT * INTO v_reservation
    FROM public.reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    v_new_start_at := ((p_new_date::text || ' ' || p_new_time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
    v_new_end_at := v_new_start_at + (p_duration_minutes || ' minutes')::interval;

    -- Verificar disponibilidad de mesas si se especificaron
    IF p_new_table_ids IS NOT NULL THEN
        FOREACH v_table_id IN ARRAY p_new_table_ids
        LOOP
            IF NOT is_table_available(v_table_id, p_new_date, v_new_start_at, v_new_end_at) THEN
                RETURN json_build_object('success', false, 'error', 'Una o más mesas no están disponibles');
            END IF;
        END LOOP;

        -- Eliminar asignaciones antiguas
        DELETE FROM public.table_assignments WHERE reservation_id = p_reservation_id;

        -- Crear nuevas asignaciones
        FOREACH v_table_id IN ARRAY p_new_table_ids
        LOOP
            INSERT INTO public.table_assignments (reservation_id, table_id)
            VALUES (p_reservation_id, v_table_id);
        END LOOP;
    END IF;

    -- Actualizar reserva
    UPDATE public.reservations
    SET 
        date = p_new_date,
        time = p_new_time,
        duration_minutes = p_duration_minutes,
        start_at = v_new_start_at,
        end_at = v_new_end_at,
        updated_at = NOW()
    WHERE id = p_reservation_id;

    RETURN json_build_object('success', true, 'message', 'Reserva movida exitosamente');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION move_reservation_with_validation TO authenticated;
GRANT EXECUTE ON FUNCTION move_reservation_with_validation TO service_role;

-- ========================================
-- FUNCIÓN 10: ADMIN - CREAR RESERVA
-- ========================================
CREATE OR REPLACE FUNCTION public.admin_create_reservation(
    p_name text,
    p_email text,
    p_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text DEFAULT '',
    p_duration_minutes integer DEFAULT 90,
    p_preferred_zone_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_result json;
BEGIN
    -- Crear o encontrar cliente
    v_customer_id := create_customer_optional_email(p_name, p_phone, p_email);

    -- Crear reserva con asignación automática
    v_result := create_reservation_with_assignment(
        v_customer_id,
        p_date,
        p_time,
        p_guests,
        p_special_requests,
        p_duration_minutes,
        p_preferred_zone_id
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_reservation TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_reservation TO service_role;

-- ========================================
-- FUNCIÓN 11: ADMIN - CREAR RESERVA CON MESAS MANUALES
-- ========================================
CREATE OR REPLACE FUNCTION admin_create_reservation_manual_tables(
    p_name text,
    p_email text,
    p_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_table_ids uuid[],
    p_special_requests text DEFAULT '',
    p_duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_reservation_id UUID;
    v_start_at timestamptz;
    v_end_at timestamptz;
    v_table_id uuid;
BEGIN
    -- Crear o encontrar cliente
    v_customer_id := create_customer_optional_email(p_name, p_phone, p_email);

    v_start_at := ((p_date::text || ' ' || p_time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    -- Verificar disponibilidad de todas las mesas
    FOREACH v_table_id IN ARRAY p_table_ids
    LOOP
        IF NOT is_table_available(v_table_id, p_date, v_start_at, v_end_at) THEN
            RETURN json_build_object('success', false, 'error', 'Una o más mesas no están disponibles');
        END IF;
    END LOOP;

    -- Crear reserva
    INSERT INTO public.reservations (
        customer_id, date, time, guests, status,
        special_requests, duration_minutes, start_at, end_at
    )
    VALUES (
        v_customer_id, p_date, p_time, p_guests, 'confirmed',
        p_special_requests, p_duration_minutes, v_start_at, v_end_at
    )
    RETURNING id INTO v_reservation_id;

    -- Asignar mesas
    FOREACH v_table_id IN ARRAY p_table_ids
    LOOP
        INSERT INTO public.table_assignments (reservation_id, table_id)
        VALUES (v_reservation_id, v_table_id);
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'tables_assigned', p_table_ids
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_reservation_manual_tables TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_reservation_manual_tables TO service_role;

-- ========================================
-- FUNCIONES PÚBLICAS (FRONTEND PÚBLICO)
-- ========================================

-- Buscar reserva por teléfono
CREATE OR REPLACE FUNCTION public_find_reservation(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    SELECT json_build_object(
        'success', true,
        'reservations', json_agg(
            json_build_object(
                'id', r.id,
                'date', r.date,
                'time', r.time,
                'guests', r.guests,
                'status', r.status,
                'customer_name', c.name
            )
        )
    )
    INTO v_result
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    WHERE c.phone = p_phone
      AND r.date >= CURRENT_DATE
      AND r.status IN ('confirmed', 'arrived')
    ORDER BY r.date, r.time;

    RETURN COALESCE(v_result, json_build_object('success', true, 'reservations', '[]'::json));
END;
$$;

GRANT EXECUTE ON FUNCTION public_find_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_find_reservation TO authenticated;

-- Cancelar reserva
CREATE OR REPLACE FUNCTION public_cancel_reservation(
    p_phone text,
    p_date date,
    p_time time DEFAULT NULL,
    p_reason text DEFAULT 'Cancelada por el cliente'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id uuid;
BEGIN
    SELECT r.id INTO v_reservation_id
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    WHERE c.phone = p_phone
      AND r.date = p_date
      AND (p_time IS NULL OR r.time = p_time)
      AND r.status IN ('confirmed', 'arrived')
    LIMIT 1;

    IF v_reservation_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    UPDATE public.reservations
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = v_reservation_id;

    RETURN json_build_object('success', true, 'message', 'Reserva cancelada exitosamente');
END;
$$;

GRANT EXECUTE ON FUNCTION public_cancel_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_cancel_reservation TO authenticated;

-- ========================================
-- FUNCIONES DE GESTIÓN DE ZONAS
-- ========================================

CREATE OR REPLACE FUNCTION get_zones_ordered()
RETURNS TABLE (
    id UUID,
    name TEXT,
    color TEXT,
    priority_order INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT z.id, z.name, z.color, z.priority_order
    FROM public.zones z
    ORDER BY z.priority_order NULLS LAST, z.name;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_zones_ordered TO authenticated;
GRANT EXECUTE ON FUNCTION get_zones_ordered TO service_role;

CREATE OR REPLACE FUNCTION create_zone(
    p_name TEXT,
    p_color TEXT DEFAULT '#6B7280',
    p_priority_order INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_zone_id UUID;
BEGIN
    INSERT INTO public.zones (name, color, priority_order)
    VALUES (p_name, p_color, p_priority_order)
    RETURNING id INTO v_zone_id;
    
    RETURN v_zone_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION create_zone TO authenticated;
GRANT EXECUTE ON FUNCTION create_zone TO service_role;

CREATE OR REPLACE FUNCTION update_zone(
    p_zone_id UUID,
    p_name TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL,
    p_priority_order INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.zones
    SET 
        name = COALESCE(p_name, name),
        color = COALESCE(p_color, color),
        priority_order = COALESCE(p_priority_order, priority_order)
    WHERE id = p_zone_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_zone TO authenticated;
GRANT EXECUTE ON FUNCTION update_zone TO service_role;

CREATE OR REPLACE FUNCTION delete_zone(p_zone_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tables SET zone_id = NULL WHERE zone_id = p_zone_id;
    DELETE FROM public.zones WHERE id = p_zone_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION delete_zone TO authenticated;
GRANT EXECUTE ON FUNCTION delete_zone TO service_role;

CREATE OR REPLACE FUNCTION reorder_zone_priorities(p_zone_ids UUID[])
RETURNS BOOLEAN AS $$
DECLARE
    v_zone_id UUID;
    v_index INTEGER := 1;
BEGIN
    FOREACH v_zone_id IN ARRAY p_zone_ids
    LOOP
        UPDATE public.zones
        SET priority_order = v_index
        WHERE id = v_zone_id;
        
        v_index := v_index + 1;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION reorder_zone_priorities TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_zone_priorities TO service_role;

-- ========================================
-- FIN DE FUNCIONES DE RESERVAS
-- ========================================
