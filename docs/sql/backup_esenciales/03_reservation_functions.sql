-- ========================================
-- FUNCIONES DE RESERVAS - VERSIÓN FINAL CORREGIDA
-- ========================================
-- Incluye todas las correcciones aplicadas:
-- - Estados correctos: 'confirmed', 'arrived' (no 'seated')
-- - Tipos corregidos: SUM()::integer (no bigint)
-- - Función optimizada sin bucles FOR anidados
-- - Campo max_diners (no max_diners_per_service)

-- ========================================
-- LIMPIAR FUNCIONES EXISTENTES
-- ========================================
DROP FUNCTION IF EXISTS get_available_time_slots(date, integer, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability(date, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability_with_capacity(date, integer, integer);
DROP FUNCTION IF EXISTS create_reservation_with_assignment(uuid, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS create_reservation_with_specific_tables(uuid, date, time, integer, text, uuid[], integer);
DROP FUNCTION IF EXISTS is_table_available(uuid, date, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS check_diners_limit(date, time, integer);

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
SECURITY DEFINER
AS $$
DECLARE
    v_conflict_count integer;
BEGIN
    -- Verificar si hay conflictos con reservas existentes
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.reservations r
    JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
    WHERE rta.table_id = p_table_id
      AND r.date = p_date
      AND r.status IN ('confirmed', 'arrived')  -- ✅ Estados correctos
      AND (
          (r.start_at < p_end_at AND r.end_at > p_start_at)
      );
    
    RETURN v_conflict_count = 0;
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
    v_schedule_record RECORD;
    v_current_diners INTEGER;
    v_max_diners INTEGER;
    v_day_of_week INTEGER;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    SELECT * INTO v_schedule_record
    FROM public.restaurant_schedules 
    WHERE day_of_week = v_day_of_week AND is_active = true
    LIMIT 1;
    
    -- ✅ CORRECCIÓN: max_diners en lugar de max_diners_per_service
    IF FOUND AND v_schedule_record.max_diners IS NOT NULL THEN
        IF p_time >= v_schedule_record.opening_time AND p_time < v_schedule_record.closing_time THEN
            SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
            FROM public.reservations r
            WHERE r.date = p_date
              AND r.status IN ('confirmed', 'arrived')  -- ✅ Estados correctos
              AND r.time >= v_schedule_record.opening_time 
              AND r.time < v_schedule_record.closing_time;
              
            -- ✅ CORRECCIÓN: max_diners en lugar de max_diners_per_service
            v_max_diners := v_schedule_record.max_diners;
            
            IF (v_current_diners + p_guests) > v_max_diners THEN
                RETURN json_build_object(
                    'success', false, 
                    'error', format('Límite de comensales excedido. Máximo: %s, Actuales: %s, Solicitados: %s', 
                                  v_max_diners, v_current_diners, p_guests)
                );
            END IF;
        END IF;
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$;

-- ========================================
-- FUNCIÓN 3: OBTENER SLOTS DISPONIBLES (OPTIMIZADA)
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
    v_schedule_record record;
    v_current_diners integer;
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

    -- Obtener horario del día (solo uno por simplicidad)
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

    -- Calcular comensales actuales en el turno (una sola vez)
    v_current_diners := 0;
    IF v_schedule_record.max_diners IS NOT NULL THEN
        SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
        FROM public.reservations r
        WHERE r.date = p_date
          AND r.status IN ('confirmed', 'arrived')  -- ✅ Estados correctos
          AND r.time >= v_schedule_record.opening_time 
          AND r.time < v_schedule_record.closing_time;
    END IF;

    -- Verificar límite de comensales antes de procesar slots
    IF v_schedule_record.max_diners IS NOT NULL 
       AND (v_current_diners + p_guests) > v_schedule_record.max_diners THEN
        -- Límite excedido, no devolver slots
        RETURN;
    END IF;

    -- ✅ OPTIMIZACIÓN: Una sola consulta sin bucles FOR
    RETURN QUERY
    SELECT 
        ts.id,
        ts.time as slot_time,
        LEAST(
            -- ✅ CAST a integer para corregir error de tipos
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
            -- Capacidad máxima del slot
            ts.max_capacity
        ) as capacity
    FROM public.time_slots ts
    WHERE ts.time >= v_schedule_record.opening_time 
      AND ts.time < v_schedule_record.closing_time
      AND LEAST(
            -- ✅ CAST a integer aquí también
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
    ORDER BY ts.time
    LIMIT 100;  -- ✅ Límite de seguridad

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
    v_slots json;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', id,
            'time', slot_time,
            'capacity', capacity
        )
    ) INTO v_slots
    FROM get_available_time_slots(p_date, p_guests, p_duration_minutes);
    
    RETURN json_build_object(
        'success', true,
        'date', p_date,
        'guests', p_guests,
        'available_slots', COALESCE(v_slots, '[]'::json)
    );
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
-- LIMPIAR CACHE Y COMENTARIOS
-- ========================================
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION is_table_available IS 'Verifica si una mesa está disponible en un horario específico';
COMMENT ON FUNCTION check_diners_limit IS 'Verifica límites de comensales por turno';
COMMENT ON FUNCTION get_available_time_slots IS 'Obtiene slots de tiempo disponibles para una fecha y número de huéspedes';
COMMENT ON FUNCTION api_check_availability IS 'API para verificar disponibilidad de reservas';
COMMENT ON FUNCTION create_reservation_with_assignment IS 'Crea una reserva con asignación automática de mesas';

-- ========================================
-- FINALIZACIÓN
-- ========================================
SELECT 'FUNCIONES DE RESERVAS CORREGIDAS' as status,
       'Todas las correcciones aplicadas: estados, tipos, optimizaciones' as mensaje;

-- ========================================
-- FUNCIONES CRÍTICAS AGREGADAS DESDE FIXES
-- ========================================

-- FUNCIÓN CRÍTICA: update_reservation_details (CORREGIDA)
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
    
    -- ✅ ACTUALIZAR SIN COALESCE PROBLEMÁTICO
    UPDATE public.reservations
    SET 
        guests = CASE WHEN p_guests IS NOT NULL THEN p_guests ELSE guests END,
        special_requests = CASE WHEN p_special_requests IS NOT NULL THEN p_special_requests ELSE special_requests END,
        -- ✅ CAST EXPLÍCITO PARA EVITAR ERROR DE TIPOS
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
    
    -- ✅ DEVOLVER RESULTADO SIN COALESCE PROBLEMÁTICO
    RETURN json_build_object(
        'success', true,
        'message', 'Reserva actualizada exitosamente',
        'reservation_id', p_reservation_id,
        'updated_fields', json_build_object(
            'guests', CASE WHEN p_guests IS NOT NULL THEN p_guests ELSE v_reservation.guests END,
            'special_requests', CASE WHEN p_special_requests IS NOT NULL THEN p_special_requests ELSE v_reservation.special_requests END,
            'status', CASE WHEN p_status IS NOT NULL THEN p_status ELSE v_reservation.status::text END
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al actualizar la reserva: ' || SQLERRM
    );
END;
$$;

-- FUNCIONES CRÍTICAS: move_reservation_with_validation (COMPATIBILIDAD)
-- Función para cambiar horario (4 parámetros)
CREATE OR REPLACE FUNCTION move_reservation_with_validation(
    p_duration_minutes integer,
    p_new_date date,
    p_new_time time,
    p_reservation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    -- Verificar que la reserva existe
    IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE id = p_reservation_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Reserva no encontrada'
        );
    END IF;
    
    -- Calcular horarios
    v_start_time := (p_new_date::text || ' ' || p_new_time::text)::timestamp AT TIME ZONE 'Europe/Madrid';
    v_end_time := v_start_time + (p_duration_minutes || ' minutes')::interval;
    
    -- Actualizar solo fecha/hora (mantener mesas actuales)
    UPDATE public.reservations
    SET 
        date = p_new_date,
        time = p_new_time,
        duration_minutes = p_duration_minutes,
        start_at = v_start_time,
        end_at = v_end_time,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Horario actualizado exitosamente',
        'reservation_id', p_reservation_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al actualizar la reserva: ' || SQLERRM
    );
END;
$$;

-- Función para cambiar mesa (5 parámetros)
CREATE OR REPLACE FUNCTION move_reservation_with_validation(
    p_duration_minutes integer,
    p_new_date date,
    p_new_table_ids uuid[],
    p_new_time time,
    p_reservation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table_id UUID;
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    -- Verificar que la reserva existe
    IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE id = p_reservation_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Reserva no encontrada'
        );
    END IF;
    
    -- Verificar que las mesas existen
    FOREACH v_table_id IN ARRAY p_new_table_ids
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = v_table_id AND is_active = true) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Una o más mesas no existen'
            );
        END IF;
    END LOOP;
    
    -- Calcular horarios
    v_start_time := (p_new_date::text || ' ' || p_new_time::text)::timestamp AT TIME ZONE 'Europe/Madrid';
    v_end_time := v_start_time + (p_duration_minutes || ' minutes')::interval;
    
    -- Actualizar reserva completa
    UPDATE public.reservations
    SET 
        date = p_new_date,
        time = p_new_time,
        duration_minutes = p_duration_minutes,
        start_at = v_start_time,
        end_at = v_end_time,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- Actualizar asignaciones de mesas
    DELETE FROM public.reservation_table_assignments
    WHERE reservation_id = p_reservation_id;
    
    FOREACH v_table_id IN ARRAY p_new_table_ids
    LOOP
        INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
        VALUES (p_reservation_id, v_table_id);
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reserva actualizada exitosamente',
        'reservation_id', p_reservation_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al actualizar la reserva: ' || SQLERRM
    );
END;
$$;

-- FUNCIÓN PARA CANCELAR RESERVA POR ID
CREATE OR REPLACE FUNCTION cancel_reservation_by_id(
    p_reservation_id uuid,
    p_reason text DEFAULT 'Cancelada por el cliente'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar que la reserva existe y se puede cancelar
    IF NOT EXISTS (
        SELECT 1 FROM public.reservations 
        WHERE id = p_reservation_id 
          AND status IN ('confirmed', 'pending')
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Reserva no encontrada o no se puede cancelar'
        );
    END IF;
    
    -- Cancelar la reserva
    UPDATE public.reservations
    SET 
        status = 'cancelled',
        special_requests = CASE 
            WHEN special_requests IS NULL THEN p_reason
            ELSE special_requests || ' | ' || p_reason
        END,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reserva cancelada exitosamente',
        'reservation_id', p_reservation_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al cancelar reserva: ' || SQLERRM
    );
END;
$$;

-- ========================================
-- COMENTARIOS PARA FUNCIONES CRÍTICAS
-- ========================================
COMMENT ON FUNCTION update_reservation_details IS 'Actualiza detalles de reserva sin COALESCE problemático';
COMMENT ON FUNCTION move_reservation_with_validation IS 'Mueve reserva con validación - versiones de compatibilidad';
COMMENT ON FUNCTION cancel_reservation_by_id IS 'Cancela reserva específica por ID';

-- ========================================
-- LIMPIAR CACHE Y COMENTARIOS
-- ========================================
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION is_table_available IS 'Verifica si una mesa está disponible en un horario específico';
COMMENT ON FUNCTION check_diners_limit IS 'Verifica límites de comensales por turno';
COMMENT ON FUNCTION get_available_time_slots IS 'Obtiene slots de tiempo disponibles para una fecha y número de huéspedes';
COMMENT ON FUNCTION api_check_availability IS 'API para verificar disponibilidad de reservas';
COMMENT ON FUNCTION create_reservation_with_assignment IS 'Crea una reserva con asignación automática de mesas';

-- ========================================
-- FINALIZACIÓN
-- ========================================
SELECT 'FUNCIONES DE RESERVAS CORREGIDAS Y ACTUALIZADAS' as status,
       'Todas las correcciones aplicadas: estados, tipos, optimizaciones y funciones críticas' as mensaje;
