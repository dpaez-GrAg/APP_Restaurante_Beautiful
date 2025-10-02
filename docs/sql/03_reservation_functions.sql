-- ========================================
-- FUNCIONES DE RESERVAS - VERSIÓN FINAL CORREGIDA
-- ========================================
-- Incluye todas las correcciones aplicadas:
-- - Estados correctos: 'confirmed', 'arrived' (no 'seated')
-- - Tipos corregidos: SUM()::integer (no bigint)
-- - Función optimizada sin bucles FOR anidados
-- - Campo max_diners (no max_diners_per_service)
-- - Soporte para zona preferida (p_preferred_zone_id)

-- ========================================
-- LIMPIEZA DE FUNCIONES EXISTENTES
-- ========================================
-- Ejecutar antes de recrear funciones para evitar conflictos de sobrecarga

-- Funciones de movimiento de reservas (2 versiones con diferente número de parámetros)
DROP FUNCTION IF EXISTS public.move_reservation_with_validation CASCADE;

-- Funciones de API pública (pueden tener múltiples versiones)
DROP FUNCTION IF EXISTS public.public_create_reservation CASCADE;

-- Otras funciones que podrían tener conflictos
DROP FUNCTION IF EXISTS public.create_reservation_with_assignment CASCADE;
DROP FUNCTION IF EXISTS public.admin_create_reservation CASCADE;

-- ========================================
-- INICIO DE DEFINICIONES DE FUNCIONES
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
-- Soporta selección de zona preferida para priorizar mesas de esa zona
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
    p_customer_id uuid,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text,
    p_duration_minutes integer DEFAULT 120,
    p_preferred_zone_id uuid DEFAULT NULL
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

 -- PASO 1: Buscar mesa individual RESPETANDO PRIORIDAD DE ZONAS Y ZONA PREFERIDA
    SELECT t.id
    INTO v_table_record
    FROM public.tables t
    LEFT JOIN public.zones z ON t.zone_id = z.id
    WHERE t.is_active = true
      AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
      AND is_table_available(t.id, p_date, v_start_at, v_end_at)
      AND (p_preferred_zone_id IS NULL OR t.zone_id = p_preferred_zone_id)
    ORDER BY 
        CASE WHEN t.zone_id = p_preferred_zone_id THEN 0 ELSE 1 END,  -- Zona preferida primero
        COALESCE(z.priority_order, 999) ASC,  -- Luego zonas con menor número
        (t.capacity + COALESCE(t.extra_capacity, 0)) ASC  -- Finalmente por capacidad
    LIMIT 1;

    IF FOUND THEN
        -- Encontramos una mesa individual que funciona
        v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
        SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
        FROM public.tables t WHERE t.id = v_table_record.id;
    ELSE
        -- PASO 2: No hay mesa individual, buscar combinaciones válidas
        -- Si hay zona preferida, intentar solo en esa zona primero
        IF p_preferred_zone_id IS NOT NULL THEN
            FOR v_combination IN
                SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
                FROM public.table_combinations tc
                WHERE tc.is_active = true
                  AND p_guests >= COALESCE(tc.min_capacity, 1)
                  AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
                  AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
                  -- Verificar que todas las mesas estén en la zona preferida
                  AND (
                    SELECT bool_and(t.zone_id = p_preferred_zone_id)
                    FROM unnest(tc.table_ids) AS table_id
                    JOIN public.tables t ON t.id = table_id
                  )
                ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC
            LOOP
                IF (
                    SELECT bool_and(is_table_available(table_id, p_date, v_start_at, v_end_at))
                    FROM unnest(v_combination.table_ids) AS table_id
                ) THEN
                    v_assigned_tables := v_combination.table_ids;
                    v_current_capacity := v_combination.effective_capacity;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

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
COMMENT ON FUNCTION cancel_reservation_by_id IS 'Cancela reserva específica por ID';
COMMENT ON FUNCTION move_reservation_with_validation(integer, date, time, uuid) 
IS 'Mueve reserva cambiando solo horario - mantiene mesas asignadas';
COMMENT ON FUNCTION move_reservation_with_validation(integer, date, uuid[], time, uuid) 
IS 'Mueve reserva cambiando horario y mesas asignadas';


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

-- ========================================
-- API PÚBLICA PARA AGENTES EXTERNOS
-- ========================================
-- Funciones normalizadas para uso externo sin UUIDs

-- ELIMINAR FUNCIONES PÚBLICAS EXISTENTES PARA PERMITIR CAMBIO DE PARÁMETROS
DROP FUNCTION IF EXISTS public_create_reservation(text,text,date,time,integer,text,integer,text);
DROP FUNCTION IF EXISTS public_create_reservation(text,text,text,date,time,integer,text,integer,text);
DROP FUNCTION IF EXISTS public_find_reservation(text);
DROP FUNCTION IF EXISTS public_cancel_reservation(text,date,time,text);

-- FUNCIÓN PÚBLICA: Crear reserva completa con datos del cliente
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
    v_reservation_result json;
    v_customer_exists boolean;
BEGIN
    -- Validar datos obligatorios
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El nombre del cliente es obligatorio'
        );
    END IF;
    
    IF p_phone IS NULL OR trim(p_phone) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El teléfono del cliente es obligatorio'
        );
    END IF;
    
    -- Verificar si el cliente ya existe por teléfono
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = p_phone
    LIMIT 1;
    
    v_customer_exists := FOUND;
    
    -- Si no existe, crear el cliente
    IF NOT v_customer_exists THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (trim(p_name), trim(p_phone), trim(p_email))
        RETURNING id INTO v_customer_id;
    ELSE
        -- Actualizar datos del cliente existente si es necesario
        UPDATE public.customers
        SET 
            name = CASE WHEN trim(p_name) != '' THEN trim(p_name) ELSE name END,
            email = CASE WHEN p_email IS NOT NULL AND trim(p_email) != '' THEN trim(p_email) ELSE email END,
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;
    
    -- Crear la reserva usando la función existente
    SELECT create_reservation_with_assignment(
        v_customer_id,
        p_date,
        p_time,
        p_guests,
        p_special_requests,
        p_duration_minutes
    ) INTO v_reservation_result;
    
    -- Verificar si la reserva se creó exitosamente
    IF (v_reservation_result->>'success')::boolean = true THEN
        -- Devolver respuesta completa con datos del cliente
        RETURN json_build_object(
            'success', true,
            'message', 'Reserva creada exitosamente',
            'reservation_id', v_reservation_result->>'reservation_id',
            'customer', json_build_object(
                'id', v_customer_id,
                'name', p_name,
                'phone', p_phone,
                'email', p_email,
                'was_created', NOT v_customer_exists
            ),
            'reservation', json_build_object(
                'date', p_date,
                'time', p_time,
                'guests', p_guests,
                'duration_minutes', p_duration_minutes,
                'special_requests', p_special_requests
            ),
            'tables_assigned', v_reservation_result->'tables_assigned'
        );
    ELSE
        -- Si falló la reserva, devolver el error
        RETURN v_reservation_result;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al crear la reserva: ' || SQLERRM
    );
END;
$$;

-- FUNCIÓN PÚBLICA: Buscar reserva por teléfono
CREATE OR REPLACE FUNCTION public_find_reservation(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN find_reservation_by_phone(p_phone);
END;
$$;

-- FUNCIÓN PÚBLICA: Cancelar reserva por teléfono y fecha
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
    v_reservations_found integer;
BEGIN
    -- Buscar la reserva por teléfono y fecha
    IF p_time IS NOT NULL THEN
        -- Buscar por teléfono, fecha y hora específica
        SELECT r.id INTO v_reservation_id
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE c.phone = p_phone
          AND r.date = p_date
          AND r.time = p_time
          AND r.status IN ('confirmed', 'pending')
        LIMIT 1;
    ELSE
        -- Buscar por teléfono y fecha (cualquier hora)
        SELECT r.id, COUNT(*) OVER() INTO v_reservation_id, v_reservations_found
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE c.phone = p_phone
          AND r.date = p_date
          AND r.status IN ('confirmed', 'pending')
        LIMIT 1;
        
        -- Si hay múltiples reservas, requerir hora específica
        IF v_reservations_found > 1 THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Se encontraron múltiples reservas para esa fecha. Especifica la hora.',
                'reservations_found', v_reservations_found
            );
        END IF;
    END IF;
    
    IF v_reservation_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se encontró ninguna reserva activa para cancelar'
        );
    END IF;
    
    -- Cancelar la reserva usando la función existente
    RETURN cancel_reservation_by_id(v_reservation_id, p_reason);
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al cancelar la reserva: ' || SQLERRM
    );
END;
$$;

-- ========================================
-- COMENTARIOS PARA API PÚBLICA
-- ========================================
COMMENT ON FUNCTION public_create_reservation(text, text, date, time, integer, text, integer, text) 
IS 'API pública: Crear reserva con gestión automática de clientes';
COMMENT ON FUNCTION public_find_reservation IS 'API pública: Buscar reservas por teléfono';
COMMENT ON FUNCTION public_cancel_reservation IS 'API pública: Cancelar reserva por teléfono y fecha';


-- Calcular ocupación de un slot específico
CREATE OR REPLACE FUNCTION public.calculate_slot_occupation(
    p_date DATE,
    p_slot_time TIME,
    p_schedule_start TIME,
    p_schedule_end TIME,
    p_excluded_reservation_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_diners INTEGER;
    v_slot_ts TIMESTAMPTZ;
    v_slot_end_ts TIMESTAMPTZ;
BEGIN
    v_slot_ts := (p_date::TEXT || ' ' || p_slot_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid';
    v_slot_end_ts := v_slot_ts + INTERVAL '15 minutes';
    
    SELECT COALESCE(SUM(r.guests), 0)
    INTO v_total_diners
    FROM public.reservations r
    WHERE r.date = p_date
      AND r.status IN ('confirmed', 'arrived')
      AND (p_excluded_reservation_id IS NULL OR r.id != p_excluded_reservation_id)
      AND (p_date::TEXT || ' ' || r.time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid' < v_slot_end_ts
      AND ((p_date::TEXT || ' ' || r.time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid' + 
           (COALESCE(r.duration_minutes, 90) || ' minutes')::INTERVAL) > v_slot_ts
      AND r.time >= p_schedule_start
      AND r.time < p_schedule_end;
    
    RETURN v_total_diners;
END;
$$;

-- Determinar tipo de horario
CREATE OR REPLACE FUNCTION public.get_schedule_type(
    p_day_of_week INTEGER,
    p_time TIME
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Slots disponibles con sistema de 15 minutos (VERSIÓN FINAL)
DROP FUNCTION IF EXISTS public.get_available_time_slots_15min(date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_available_time_slots_15min(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 90
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
    v_schedule_type text;
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

    FOR v_schedule_record IN 
        SELECT rs.opening_time, rs.closing_time, rs.max_diners
        FROM public.restaurant_schedules rs
        WHERE rs.day_of_week = v_day_of_week 
          AND rs.is_active = true
        ORDER BY rs.opening_time
    LOOP
        v_current_diners := 0;
        IF v_schedule_record.max_diners IS NOT NULL THEN
            SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
            FROM public.reservations r
            WHERE r.date = p_date
              AND r.status IN ('confirmed', 'arrived')
              AND r.time >= v_schedule_record.opening_time 
              AND r.time < v_schedule_record.closing_time;
        END IF;

        IF v_schedule_record.max_diners IS NOT NULL 
           AND (v_current_diners + p_guests) > v_schedule_record.max_diners THEN
            CONTINUE;
        END IF;

        v_schedule_type := get_schedule_type(v_day_of_week, v_schedule_record.opening_time);

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
          AND NOT EXISTS (
              SELECT 1
              WHERE (
                  SELECT 
                      CASE 
                          WHEN (
                              SELECT max_diners 
                              FROM public.slot_capacity_limits scl
                              WHERE scl.day_of_week = v_day_of_week
                                AND scl.schedule_type = v_schedule_type
                                AND scl.slot_time = ts.time
                          ) IS NOT NULL
                          THEN (
                              SELECT (
                                  calculate_slot_occupation(
                                      p_date,
                                      ts.time,
                                      v_schedule_record.opening_time,
                                      v_schedule_record.closing_time,
                                      NULL
                                  ) + p_guests
                              ) > (
                                  SELECT max_diners 
                                  FROM public.slot_capacity_limits scl
                                  WHERE scl.day_of_week = v_day_of_week
                                    AND scl.schedule_type = v_schedule_type
                                    AND scl.slot_time = ts.time
                              )
                          )
                          ELSE false
                      END
              )
          )
        ORDER BY ts.time
        LIMIT 100;
    END LOOP;

    RETURN;
END;
$$;

-- Función para admin_create_reservation (VERSIÓN FINAL)
-- Soporta zona preferida para creación desde panel de administración
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, time, integer, text, uuid[], integer);
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, time, integer, text, integer, uuid);

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
    v_customer_exists BOOLEAN;
    v_result json;
BEGIN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = p_phone LIMIT 1;
    
    v_customer_exists := FOUND;
    
    IF v_customer_exists THEN
        UPDATE public.customers
        SET name = p_name,
            email = COALESCE(NULLIF(p_email, ''), email),
            updated_at = NOW()
        WHERE id = v_customer_id;
    ELSE
        INSERT INTO public.customers (name, email, phone)
        VALUES (p_name, NULLIF(p_email, ''), p_phone)
        RETURNING id INTO v_customer_id;
    END IF;
    
    SELECT create_reservation_with_assignment(
        v_customer_id,
        p_date,
        p_time,
        p_guests,
        p_special_requests,
        p_duration_minutes,
        p_preferred_zone_id
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;



-- ========================================
-- FUNCIONES DE GESTIÓN DE ZONAS
-- ========================================

CREATE OR REPLACE FUNCTION get_zones_ordered()
RETURNS TABLE (
    id UUID,
    name TEXT,
    color TEXT,
    priority_order INTEGER,
    is_active BOOLEAN,
    table_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        z.id,
        z.name,
        z.color,
        z.priority_order,
        z.is_active,
        COUNT(t.id) as table_count
    FROM zones z
    LEFT JOIN tables t ON t.zone_id = z.id AND t.is_active = true
    WHERE z.is_active = true
    GROUP BY z.id, z.name, z.color, z.priority_order, z.is_active
    ORDER BY z.priority_order ASC, z.name ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_zone(
    p_name TEXT,
    p_color TEXT DEFAULT '#6B7280',
    p_priority_order INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_zone_id UUID;
    v_max_priority INTEGER;
BEGIN
    IF p_priority_order IS NULL THEN
        SELECT COALESCE(MAX(priority_order), 0) + 1 INTO v_max_priority FROM zones;
        p_priority_order := v_max_priority;
    END IF;

    INSERT INTO zones (name, color, priority_order)
    VALUES (p_name, p_color, p_priority_order)
    RETURNING id INTO v_zone_id;

    RETURN v_zone_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_zone(
    p_zone_id UUID,
    p_name TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL,
    p_priority_order INTEGER DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE zones
    SET 
        name = COALESCE(p_name, name),
        color = COALESCE(p_color, color),
        priority_order = COALESCE(p_priority_order, priority_order),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_zone_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_zone(p_zone_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tables SET zone_id = NULL WHERE zone_id = p_zone_id;
    UPDATE zones SET is_active = false WHERE id = p_zone_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reorder_zone_priorities(p_zone_ids UUID[])
RETURNS BOOLEAN AS $$
DECLARE
    v_zone_id UUID;
    v_index INTEGER := 1;
BEGIN
    FOREACH v_zone_id IN ARRAY p_zone_ids
    LOOP
        UPDATE zones SET priority_order = v_index WHERE id = v_zone_id;
        v_index := v_index + 1;
    END LOOP;
    RETURN true;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- COMENTARIOS ACTUALIZADOS
-- ========================================
COMMENT ON FUNCTION create_reservation_with_assignment(uuid, date, time, integer, text, integer, uuid) 
IS 'Crea reserva con asignación automática de mesas. Soporta zona preferida opcional para priorizar mesas de esa zona.';

COMMENT ON FUNCTION admin_create_reservation(text, text, text, date, time, integer, text, integer, uuid) 
IS 'Crea reserva desde admin con gestión automática de clientes. Soporta zona preferida opcional.';


NOTIFY pgrst, 'reload schema';