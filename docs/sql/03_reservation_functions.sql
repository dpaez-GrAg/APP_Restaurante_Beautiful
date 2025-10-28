-- ========================================
-- FUNCIONES DE RESERVAS - VERSIÓN COMPLETA Y ACTUALIZADA
-- ========================================
-- Fecha: 2025-10-28
-- 
-- Este archivo consolida TODAS las funciones de reservas actualizadas:
-- - Funciones públicas de API
-- - Funciones de disponibilidad
-- - Funciones de asignación de mesas
-- - Funciones auxiliares
--
-- IMPORTANTE: Este archivo reemplaza a:
-- - 03_reservation_functions.sql (versión antigua)
-- - 03_reservation_functions_CLEAN.sql (versión parcial)
-- - ADD_SLOTS_WITH_ZONES_FUNCTION.sql
-- - CREATE_ASSIGN_TABLES_FUNCTION.sql
-- ========================================

-- ========================================
-- FUNCIÓN 1: assign_tables_to_reservation
-- ========================================
-- Asigna mesas automáticamente a una reserva
-- Lógica: Por cada zona (prioridad), buscar mesa individual, luego combinación
-- ========================================

DROP FUNCTION IF EXISTS assign_tables_to_reservation(uuid, date, timestamptz, timestamptz, integer, uuid);

CREATE OR REPLACE FUNCTION assign_tables_to_reservation(
    p_reservation_id uuid,
    p_date date,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_guests integer,
    p_preferred_zone_id uuid DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assigned_tables uuid[] := ARRAY[]::uuid[];
    v_table_id uuid;
    v_combination record;
    v_zone record;
BEGIN
    -- Iterar por cada zona en orden de prioridad
    FOR v_zone IN
        SELECT z.id, z.priority_order
        FROM public.zones z
        WHERE z.is_active = true
          AND (p_preferred_zone_id IS NULL OR z.id = p_preferred_zone_id)
        ORDER BY 
            CASE WHEN z.id = p_preferred_zone_id THEN 0 ELSE 1 END,
            z.priority_order ASC
    LOOP
        -- Estrategia 1: Buscar UNA MESA individual que cubra la capacidad en esta zona
        SELECT t.id INTO v_table_id
        FROM public.tables t
        WHERE t.is_active = true
          AND t.zone_id = v_zone.id
          AND t.capacity >= p_guests
          AND is_table_available(t.id, p_date, p_start_at, p_end_at, NULL)
        ORDER BY t.capacity ASC  -- Mesa más pequeña que cubra
        LIMIT 1;
        
        IF FOUND THEN
            -- Asignar esta mesa
            INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
            VALUES (p_reservation_id, v_table_id);
            
            RETURN ARRAY[v_table_id];
        END IF;
        
        -- Estrategia 2: Buscar COMBINACIÓN en esta zona
        FOR v_combination IN
            SELECT tc.id, tc.table_ids, tc.total_capacity
            FROM public.table_combinations tc
            WHERE tc.is_active = true
              AND tc.zone_id = v_zone.id
              AND tc.total_capacity >= p_guests
              -- Verificar que todas las mesas están disponibles
              AND NOT EXISTS (
                  SELECT 1
                  FROM UNNEST(tc.table_ids) AS combo_table_id
                  WHERE NOT is_table_available(combo_table_id, p_date, p_start_at, p_end_at, NULL)
              )
            ORDER BY tc.total_capacity ASC  -- Combinación más pequeña que cubra
            LIMIT 1
        LOOP
            -- Asignar todas las mesas de la combinación
            FOREACH v_table_id IN ARRAY v_combination.table_ids
            LOOP
                INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
                VALUES (p_reservation_id, v_table_id);
                
                v_assigned_tables := array_append(v_assigned_tables, v_table_id);
            END LOOP;
            
            RETURN v_assigned_tables;
        END LOOP;
    END LOOP;
    
    -- Si no se encontró nada, devolver array vacío
    RETURN ARRAY[]::uuid[];
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, limpiar asignaciones
        DELETE FROM public.reservation_table_assignments 
        WHERE reservation_id = p_reservation_id;
        
        RAISE EXCEPTION 'Error al asignar mesas: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_tables_to_reservation(uuid, date, timestamptz, timestamptz, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_tables_to_reservation(uuid, date, timestamptz, timestamptz, integer, uuid) TO service_role;

COMMENT ON FUNCTION assign_tables_to_reservation IS 'Asigna mesas automáticamente: por zona, primero mesa individual, luego combinación';

-- ========================================
-- FUNCIÓN 2: get_available_time_slots_with_zones
-- ========================================
-- Obtiene slots disponibles con información de zona
-- ========================================

DROP FUNCTION IF EXISTS get_available_time_slots_with_zones(date, integer, integer);

CREATE OR REPLACE FUNCTION get_available_time_slots_with_zones(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 120
)
RETURNS TABLE(slot_time time, zone_name text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_day_of_week integer;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    RETURN QUERY
    WITH slot_times AS (
        SELECT ts.time as slot_time
        FROM public.time_slots ts
        WHERE EXISTS (
            SELECT 1 FROM public.restaurant_schedules rs
            WHERE rs.day_of_week = v_day_of_week 
              AND rs.is_active = true
              AND ts.time >= rs.opening_time 
              -- ✅ <= para INCLUIR el último slot configurado
              AND ts.time <= rs.closing_time
        )
    ),
    slot_ranges AS (
        SELECT 
            st.slot_time,
            ((p_date::text || ' ' || st.slot_time::text)::timestamp AT TIME ZONE 'Europe/Madrid') as start_at,
            ((p_date::text || ' ' || st.slot_time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval as end_at
        FROM slot_times st
    ),
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
    available_tables AS (
        SELECT 
            sr.slot_time,
            t.id as table_id,
            t.capacity,
            COALESCE(z.name, 'Sin zona') as zone_name,
            COALESCE(z.priority_order, 999) as zone_priority
        FROM slot_ranges sr
        CROSS JOIN public.tables t
        LEFT JOIN public.zones z ON t.zone_id = z.id
        WHERE t.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM occupied_tables ot
              WHERE ot.slot_time = sr.slot_time
                AND ot.table_id = t.id
          )
    ),
    available_combinations AS (
        SELECT 
            sr.slot_time,
            tc.id as combination_id,
            tc.total_capacity as capacity,
            COALESCE(z.name, 'Sin zona') as zone_name,
            COALESCE(z.priority_order, 999) as zone_priority
        FROM slot_ranges sr
        CROSS JOIN public.table_combinations tc
        LEFT JOIN public.zones z ON tc.zone_id = z.id
        WHERE tc.is_active = true
          -- ✅ Usar UNNEST del array table_ids
          AND NOT EXISTS (
              SELECT 1 
              FROM UNNEST(tc.table_ids) AS combo_table_id
              WHERE EXISTS (
                  SELECT 1 FROM occupied_tables ot
                  WHERE ot.slot_time = sr.slot_time
                    AND ot.table_id = combo_table_id
              )
          )
    ),
    all_options AS (
        SELECT at.slot_time, at.capacity, at.zone_name, at.zone_priority 
        FROM available_tables at
        UNION ALL
        SELECT ac.slot_time, ac.capacity, ac.zone_name, ac.zone_priority 
        FROM available_combinations ac
    ),
    best_option_per_slot AS (
        SELECT DISTINCT ON (ao.slot_time)
            ao.slot_time,
            ao.zone_name
        FROM all_options ao
        WHERE ao.capacity >= p_guests
        ORDER BY ao.slot_time, ao.zone_priority ASC, ao.capacity ASC
    )
    SELECT bops.slot_time, bops.zone_name
    FROM best_option_per_slot bops
    ORDER BY bops.slot_time;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_time_slots_with_zones(date, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_available_time_slots_with_zones(date, integer, integer) TO authenticated;

COMMENT ON FUNCTION get_available_time_slots_with_zones IS 'Obtiene slots disponibles con zona (incluye último slot, usa array table_ids)';

-- ========================================
-- FUNCIÓN 3: public_find_reservation
-- ========================================
-- Busca reservas activas/futuras por teléfono
-- ========================================

DROP FUNCTION IF EXISTS public_find_reservation(text);

CREATE OR REPLACE FUNCTION public_find_reservation(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    WITH reservations_data AS (
        SELECT 
            r.id,
            r.date,
            r.time,
            r.guests,
            r.status,
            c.name as customer_name
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE c.phone = p_phone
          AND r.status IN ('confirmed', 'arrived')
          -- ✅ Mostrar solo reservas que aún no han terminado
          AND r.end_at > NOW()
        ORDER BY r.date, r.time
    )
    SELECT json_build_object(
        'success', true,
        'reservations', json_agg(
            json_build_object(
                'id', rd.id,
                'date', rd.date,
                'time', rd.time,
                'guests', rd.guests,
                'status', rd.status,
                'customer_name', rd.customer_name
            )
        )
    )
    INTO v_result
    FROM reservations_data rd;

    RETURN COALESCE(v_result, json_build_object('success', true, 'reservations', '[]'::json));
END;
$$;

GRANT EXECUTE ON FUNCTION public_find_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_find_reservation TO authenticated;

COMMENT ON FUNCTION public_find_reservation IS 'API pública: Busca reservas activas/futuras por teléfono';

-- ========================================
-- FUNCIÓN 4: public_cancel_reservation
-- ========================================
-- Cancela una reserva por teléfono y fecha
-- ========================================

DROP FUNCTION IF EXISTS public_cancel_reservation(text, date, time, text);

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
    v_customer_id uuid;
BEGIN
    -- Buscar la reserva
    SELECT r.id, r.customer_id INTO v_reservation_id, v_customer_id
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    WHERE c.phone = p_phone
      AND r.date = p_date
      AND (p_time IS NULL OR r.time = p_time)
      AND r.status IN ('confirmed', 'arrived')
    ORDER BY r.time
    LIMIT 1;

    IF v_reservation_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se encontró una reserva activa para este teléfono y fecha'
        );
    END IF;

    -- Cancelar la reserva
    UPDATE public.reservations
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = v_reservation_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Reserva cancelada exitosamente',
        'reservation_id', v_reservation_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al cancelar la reserva: ' || SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public_cancel_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_cancel_reservation TO authenticated;

COMMENT ON FUNCTION public_cancel_reservation IS 'API pública: Cancela reserva por teléfono y fecha';

-- ========================================
-- FUNCIÓN 5: public_create_reservation
-- ========================================
-- Crea una reserva desde la API pública
-- ========================================

DROP FUNCTION IF EXISTS public_create_reservation(text, text, date, time, integer, text, integer, text);

CREATE OR REPLACE FUNCTION public_create_reservation(
    p_name text,
    p_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_email text DEFAULT NULL,
    p_duration_minutes integer DEFAULT 90,
    p_special_requests text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_result json;
BEGIN
    -- Buscar o crear cliente
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = p_phone;

    IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (p_name, p_phone, p_email)
        RETURNING id INTO v_customer_id;
    ELSE
        -- Actualizar datos si han cambiado
        UPDATE public.customers
        SET name = p_name,
            email = COALESCE(p_email, email),
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- Crear la reserva usando la función interna
    SELECT create_reservation_with_assignment(
        v_customer_id,
        p_date,
        p_time,
        p_guests,
        p_special_requests,
        p_duration_minutes,
        NULL  -- sin zona preferida
    ) INTO v_result;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al crear la reserva: ' || SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public_create_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_create_reservation TO authenticated;

COMMENT ON FUNCTION public_create_reservation IS 'API pública: Crea reserva con gestión automática de clientes';

-- ========================================
-- VERIFICACIÓN
-- ========================================

SELECT 'Funciones de reservas instaladas correctamente:' as status;
SELECT '✅ assign_tables_to_reservation' as funcion;
SELECT '✅ get_available_time_slots_with_zones' as funcion;
SELECT '✅ public_find_reservation' as funcion;
SELECT '✅ public_cancel_reservation' as funcion;
SELECT '✅ public_create_reservation' as funcion;
