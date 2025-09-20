-- ========================================
-- FUNCIONES DE RESERVAS Y DISPONIBILIDAD
-- ========================================
-- Este archivo contiene todas las funciones relacionadas con:
-- - Verificación de disponibilidad
-- - Creación de reservas
-- - Asignación de mesas
-- - APIs de disponibilidad


-- Funciones de: force_update_functions.sql
-- ========================================
-- ========================================
-- FORZAR ACTUALIZACIÓN DE FUNCIONES DE DISPONIBILIDAD
-- ========================================
-- Este script fuerza la actualización completa de todas las funciones

-- 1. Eliminar TODAS las versiones de las funciones
DROP FUNCTION IF EXISTS get_available_time_slots(date, integer, integer);
DROP FUNCTION IF EXISTS get_available_time_slots(date, integer, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability(date, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability_with_capacity(date, integer, integer);

-- 2. Limpiar cache de esquema
NOTIFY pgrst, 'reload schema';

-- 3. Recrear get_available_time_slots con lógica simplificada y debugging
CREATE OR REPLACE FUNCTION get_available_time_slots(
  p_date date,
  p_guests integer,
  p_duration_minutes integer
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
  v_occupied_tables_count integer;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);
  
  RAISE NOTICE 'Checking availability for date: %, guests: %, duration: %', p_date, p_guests, p_duration_minutes;

  -- Verificar si es un día especial cerrado
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days scd
  WHERE (
    (NOT scd.is_range AND scd.date = p_date) OR
    (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
  );

  IF v_special_closed THEN
    RAISE NOTICE 'Restaurant is closed on this date';
    RETURN;
  END IF;

  -- Procesar horarios regulares (simplificado)
  FOR v_schedule_record IN
    SELECT rs.opening_time, rs.closing_time, rs.max_diners
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
    ORDER BY rs.opening_time
  LOOP
    RAISE NOTICE 'Processing schedule: % to %', v_schedule_record.opening_time, v_schedule_record.closing_time;
    
    -- Procesar cada time slot en este horario
    FOR rec IN
      SELECT ts.id, ts.time, ts.max_capacity
      FROM public.time_slots ts
      WHERE ts.time >= v_schedule_record.opening_time 
        AND ts.time < v_schedule_record.closing_time
      ORDER BY ts.time
    LOOP
      RAISE NOTICE 'Checking time slot: %', rec.time;
      
      -- Calcular el tiempo de inicio y fin de la reserva
      v_start_at := ((p_date::text || ' ' || rec.time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
      v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;
      
      RAISE NOTICE 'Reservation window: % to %', v_start_at, v_end_at;

      -- Contar mesas ocupadas en este horario
      SELECT COUNT(DISTINCT rta.table_id) INTO v_occupied_tables_count
      FROM public.reservation_table_assignments rta
      JOIN public.reservations r ON rta.reservation_id = r.id
      WHERE r.date = p_date
        AND r.status IN ('confirmed', 'arrived', 'seated')
        AND (
          -- Verificar solapamiento de horarios
          (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at)
          AND
          (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
            + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at)
        );
        
      RAISE NOTICE 'Occupied tables count: %', v_occupied_tables_count;

      -- Calcular capacidad disponible (mesas NO ocupadas)
      SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_available_capacity
      FROM public.tables t
      WHERE t.is_active = true
        AND t.id NOT IN (
          SELECT DISTINCT rta.table_id
          FROM public.reservation_table_assignments rta
          JOIN public.reservations r ON rta.reservation_id = r.id
          WHERE r.date = p_date
            AND r.status IN ('confirmed', 'arrived', 'seated')
            AND (
              -- Verificar solapamiento de horarios
              (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at)
              AND
              (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at)
            )
        );
        
      RAISE NOTICE 'Available capacity: %, max_capacity: %', v_available_capacity, rec.max_capacity;

      -- Calcular comensales actuales en el turno (si hay límite configurado)
      v_current_diners := 0;
      IF v_schedule_record.max_diners IS NOT NULL THEN
        SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
        FROM public.reservations r
        WHERE r.date = p_date
          AND r.status IN ('confirmed', 'arrived', 'seated')
          AND r.time >= v_schedule_record.opening_time 
          AND r.time < v_schedule_record.closing_time;
          
        RAISE NOTICE 'Current diners: %, max diners: %', v_current_diners, v_schedule_record.max_diners;
      END IF;

      -- Verificar disponibilidad
      IF LEAST(v_available_capacity, rec.max_capacity) >= p_guests THEN
        -- Si hay límite de comensales por turno, verificar que no se exceda
        IF v_schedule_record.max_diners IS NULL OR (v_current_diners + p_guests) <= v_schedule_record.max_diners THEN
          RAISE NOTICE 'Slot % is AVAILABLE with capacity %', rec.time, LEAST(v_available_capacity, rec.max_capacity);
          id := rec.id;
          slot_time := rec.time;
          capacity := LEAST(v_available_capacity, rec.max_capacity);
          RETURN NEXT;
        ELSE
          RAISE NOTICE 'Slot % REJECTED due to diner limit', rec.time;
        END IF;
      ELSE
        RAISE NOTICE 'Slot % REJECTED due to insufficient capacity', rec.time;
      END IF;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

-- 4. Recrear funciones API
CREATE OR REPLACE FUNCTION api_check_availability_with_capacity(
  date date,
  guests integer,
  duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_slots json[];
  v_capacity_info json[];
  v_result json;
  v_total_available_slots integer;
  slot_record record;
  capacity_record record;
BEGIN
  v_available_slots := ARRAY[]::json[];
  v_capacity_info := ARRAY[]::json[];
  v_total_available_slots := 0;

  -- Obtener slots disponibles usando la función actualizada
  FOR slot_record IN
    SELECT * FROM get_available_time_slots(
      api_check_availability_with_capacity.date, 
      api_check_availability_with_capacity.guests, 
      api_check_availability_with_capacity.duration_minutes
    )
  LOOP
    v_available_slots := v_available_slots || json_build_object(
      'id', slot_record.id,
      'time', slot_record.slot_time,
      'capacity', slot_record.capacity
    );
    v_total_available_slots := v_total_available_slots + 1;
  END LOOP;

  -- Obtener información de capacidad de comensales
  FOR capacity_record IN
    SELECT * FROM get_diners_capacity_info(api_check_availability_with_capacity.date)
  LOOP
    v_capacity_info := v_capacity_info || json_build_object(
      'schedule_id', capacity_record.schedule_id,
      'opening_time', capacity_record.opening_time,
      'closing_time', capacity_record.closing_time,
      'max_diners', capacity_record.max_diners,
      'current_diners', capacity_record.current_diners,
      'available_diners', capacity_record.available_diners,
      'is_special_schedule', capacity_record.is_special_schedule
    );
  END LOOP;

  -- Construir respuesta final
  v_result := json_build_object(
    'available', v_total_available_slots > 0,
    'date', api_check_availability_with_capacity.date,
    'guests', api_check_availability_with_capacity.guests,
    'duration_minutes', api_check_availability_with_capacity.duration_minutes,
    'available_slots', v_available_slots,
    'total_slots', v_total_available_slots,
    'capacity_info', v_capacity_info,
    'debug_info', json_build_object(
      'function_version', 'force_updated_v2',
      'timestamp', now()
    )
  );

  RETURN v_result;
END;
$$;

-- 5. Recrear función simplificada
CREATE OR REPLACE FUNCTION api_check_availability(
  date date,
  guests integer,
  duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_full_result json;
BEGIN
  SELECT api_check_availability_with_capacity(
    api_check_availability.date, 
    api_check_availability.guests, 
    api_check_availability.duration_minutes
  ) INTO v_full_result;
  
  RETURN json_build_object(
    'available', v_full_result->>'available',
    'available_slots', v_full_result->'available_slots',
    'total_slots', v_full_result->>'total_slots',
    'date', api_check_availability.date,
    'guests', api_check_availability.guests,
    'duration_minutes', api_check_availability.duration_minutes,
    'debug_info', v_full_result->'debug_info'
  );
END;
$$;

-- 6. Verificar que las funciones se crearon correctamente
SELECT 'FUNCTIONS CREATED' as status, 
       COUNT(*) as function_count 
FROM pg_proc 
WHERE proname IN ('get_available_time_slots', 'api_check_availability', 'api_check_availability_with_capacity');

-- 7. Probar inmediatamente
SELECT 'TEST RESULT' as test_type, * FROM get_available_time_slots('2025-09-18', 6, 90);

-- Funciones de: fix_reservation_creation.sql
-- ========================================
-- ========================================
-- CORREGIR FUNCIONES DE CREACIÓN DE RESERVAS
-- ========================================
-- Este script corrige las funciones de creación para usar la misma lógica
-- de verificación de disponibilidad que acabamos de arreglar

-- 0. Eliminar funciones existentes para evitar errores
DROP FUNCTION IF EXISTS is_table_available(uuid, date, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS check_diners_limit(date, time, integer);
DROP FUNCTION IF EXISTS create_reservation_with_assignment(uuid, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS create_reservation_with_specific_tables(uuid, date, time, integer, text, uuid[], integer);

-- 1. Función auxiliar para verificar si una mesa está disponible
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
      AND r.status IN ('confirmed', 'arrived', 'seated')
      AND (
        -- Verificar solapamiento de horarios (misma lógica que get_available_time_slots)
        (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < p_end_time)
        AND
        (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
          + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > p_start_time)
      )
  );
END;
$$;

-- 2. Función auxiliar para verificar límites de comensales por turno
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
        AND r.status IN ('confirmed', 'arrived', 'seated')
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
        AND r.status IN ('confirmed', 'arrived', 'seated')
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

-- 3. Recrear create_reservation_with_assignment con lógica corregida
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_guests integer,
  p_special_requests text,
  p_duration_minutes integer
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
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC  -- Mesa más pequeña que cubra la necesidad
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
      ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC  -- Combinación más pequeña que funcione
    LOOP
      -- Check if all tables in this combination are available using the new function
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
      RETURN json_build_object('success', false, 'error', 'No hay mesas individuales ni combinaciones disponibles para esta capacidad');
    END IF;
  END IF;

  -- Verificar que tenemos capacidad suficiente
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
    'assigned_tables', v_assigned_tables,
    'debug_info', json_build_object(
      'function_version', 'fixed_v2',
      'capacity_used', v_current_capacity,
      'guests_requested', p_guests
    )
  );
END;
$$;

-- 4. También necesitamos corregir create_reservation_with_specific_tables
CREATE OR REPLACE FUNCTION create_reservation_with_specific_tables(
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_guests integer,
  p_special_requests text,
  p_table_ids uuid[],
  p_duration_minutes integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_total_capacity INTEGER;
  v_diners_check json;
BEGIN
  -- Normalize to Europe/Madrid
  v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Verificar límites de comensales por turno
  SELECT check_diners_limit(p_date, p_time, p_guests) INTO v_diners_check;
  IF (v_diners_check->>'success')::boolean = false THEN
    RETURN v_diners_check;
  END IF;

  -- Verificar que todas las mesas están disponibles
  IF NOT (
    SELECT bool_and(is_table_available(table_id, p_date, v_start_at, v_end_at))
    FROM unnest(p_table_ids) AS table_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'One or more selected tables are not available');
  END IF;

  -- Verificar capacidad total
  SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_total_capacity
  FROM public.tables t
  WHERE t.id = ANY(p_table_ids) AND t.is_active = true;

  IF v_total_capacity < p_guests THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
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

  -- Asignar las mesas especificadas
  INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
  SELECT v_reservation_id, unnest(p_table_ids);

  RETURN json_build_object(
    'success', true, 
    'reservation_id', v_reservation_id,
    'assigned_tables', p_table_ids,
    'debug_info', json_build_object(
      'function_version', 'fixed_v2',
      'capacity_used', v_total_capacity,
      'guests_requested', p_guests
    )
  );
END;
$$;

-- 5. Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION is_table_available IS 'Verifica si una mesa está disponible usando la misma lógica que get_available_time_slots';
COMMENT ON FUNCTION check_diners_limit IS 'Verifica límites de comensales por turno';
COMMENT ON FUNCTION create_reservation_with_assignment IS 'Función corregida para crear reservas con asignación automática';
COMMENT ON FUNCTION create_reservation_with_specific_tables IS 'Función corregida para crear reservas con mesas específicas';

-- Funciones de: fix_ui_parameters.sql
-- ========================================
-- ========================================
-- CORREGIR PARÁMETROS PARA LA UI
-- ========================================
-- La UI está enviando parámetros con prefijo p_, pero nuestras funciones usan sin prefijo
-- Necesitamos actualizar las funciones para coincidir con la UI

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS create_reservation_with_assignment(uuid, date, time, integer, text, integer);
DROP FUNCTION IF EXISTS create_reservation_with_specific_tables(uuid, date, time, integer, text, uuid[], integer);

-- Recrear create_reservation_with_assignment con parámetros p_
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_guests integer,
  p_special_requests text,
  p_duration_minutes integer
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
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC  -- Mesa más pequeña que cubra la necesidad
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
      ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC  -- Combinación más pequeña que funcione
    LOOP
      -- Check if all tables in this combination are available using the new function
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
      RETURN json_build_object('success', false, 'error', 'No hay mesas individuales ni combinaciones disponibles para esta capacidad');
    END IF;
  END IF;

  -- Verificar que tenemos capacidad suficiente
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
    'assigned_tables', v_assigned_tables,
    'debug_info', json_build_object(
      'function_version', 'ui_fixed_v3',
      'capacity_used', v_current_capacity,
      'guests_requested', p_guests
    )
  );
END;
$$;

-- Recrear create_reservation_with_specific_tables con parámetros p_
CREATE OR REPLACE FUNCTION create_reservation_with_specific_tables(
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_guests integer,
  p_special_requests text,
  p_table_ids uuid[],
  p_duration_minutes integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_total_capacity INTEGER;
  v_diners_check json;
BEGIN
  -- Normalize to Europe/Madrid
  v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Verificar límites de comensales por turno
  SELECT check_diners_limit(p_date, p_time, p_guests) INTO v_diners_check;
  IF (v_diners_check->>'success')::boolean = false THEN
    RETURN v_diners_check;
  END IF;

  -- Verificar que todas las mesas están disponibles
  IF NOT (
    SELECT bool_and(is_table_available(table_id, p_date, v_start_at, v_end_at))
    FROM unnest(p_table_ids) AS table_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'One or more selected tables are not available');
  END IF;

  -- Verificar capacidad total
  SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_total_capacity
  FROM public.tables t
  WHERE t.id = ANY(p_table_ids) AND t.is_active = true;

  IF v_total_capacity < p_guests THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
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

  -- Asignar las mesas especificadas
  INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
  SELECT v_reservation_id, unnest(p_table_ids);

  RETURN json_build_object(
    'success', true, 
    'reservation_id', v_reservation_id,
    'assigned_tables', p_table_ids,
    'debug_info', json_build_object(
      'function_version', 'ui_fixed_v3',
      'capacity_used', v_total_capacity,
      'guests_requested', p_guests
    )
  );
END;
$$;

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Probar la función con parámetros p_
SELECT 'TEST CON PARÁMETROS P_' as test_type,
       create_reservation_with_assignment(
         (SELECT id FROM customers WHERE email LIKE '%test%' LIMIT 1),
         '2025-09-19'::date,
         '14:00'::time,
         2,
         'Prueba con parámetros p_',
         90
       ) as result;

-- Funciones de: get_diners_capacity_info.sql
-- ========================================
-- ========================================
-- FUNCIÓN PARA OBTENER INFORMACIÓN DE CAPACIDAD DE COMENSALES
-- ========================================
-- Esta función devuelve información sobre los límites de comensales
-- y la ocupación actual para un día específico

CREATE OR REPLACE FUNCTION get_diners_capacity_info(
  p_date date
)
RETURNS TABLE(
  schedule_id uuid,
  opening_time time,
  closing_time time,
  max_diners integer,
  current_diners integer,
  available_diners integer,
  is_special_schedule boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week integer;
  v_special_closed boolean;
  rec record;
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

  -- Verificar horarios especiales primero
  FOR rec IN
    SELECT 
      ssd.id,
      ssd.opening_time,
      ssd.closing_time,
      ssd.max_diners,
      true as is_special
    FROM public.special_schedule_days ssd
    WHERE ssd.date = p_date AND ssd.is_active = true
    ORDER BY ssd.opening_time
  LOOP
    -- Calcular comensales actuales para este horario especial
    SELECT COALESCE(SUM(r.guests), 0) INTO current_diners
    FROM public.reservations r
    WHERE r.date = p_date
      AND r.status IN ('confirmed', 'arrived')
      AND r.time >= rec.opening_time 
      AND r.time < rec.closing_time;

    schedule_id := rec.id;
    opening_time := rec.opening_time;
    closing_time := rec.closing_time;
    max_diners := rec.max_diners;
    available_diners := CASE 
      WHEN rec.max_diners IS NOT NULL 
      THEN GREATEST(0, rec.max_diners - current_diners)
      ELSE NULL 
    END;
    is_special_schedule := true;
    
    RETURN NEXT;
  END LOOP;

  -- Si no hay horarios especiales, usar horarios regulares
  IF NOT FOUND THEN
    FOR rec IN
      SELECT 
        rs.id,
        rs.opening_time,
        rs.closing_time,
        rs.max_diners,
        false as is_special
      FROM public.restaurant_schedules rs
      WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
      ORDER BY rs.opening_time
    LOOP
      -- Calcular comensales actuales para este horario regular
      SELECT COALESCE(SUM(r.guests), 0) INTO current_diners
      FROM public.reservations r
      WHERE r.date = p_date
        AND r.status IN ('confirmed', 'arrived')
        AND r.time >= rec.opening_time 
        AND r.time < rec.closing_time;

      schedule_id := rec.id;
      opening_time := rec.opening_time;
      closing_time := rec.closing_time;
      max_diners := rec.max_diners;
      available_diners := CASE 
        WHEN rec.max_diners IS NOT NULL 
        THEN GREATEST(0, rec.max_diners - current_diners)
        ELSE NULL 
      END;
      is_special_schedule := false;
      
      RETURN NEXT;
    END LOOP;
  END IF;

  RETURN;
END;
$$;

-- Función auxiliar para verificar si una reserva excedería el límite
CREATE OR REPLACE FUNCTION check_diners_limit(
  p_date date,
  p_time time,
  p_guests integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week integer;
  v_max_diners integer;
  v_current_diners integer;
  v_opening time;
  v_closing time;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Buscar horario especial primero
  SELECT ssd.max_diners, ssd.opening_time, ssd.closing_time
  INTO v_max_diners, v_opening, v_closing
  FROM public.special_schedule_days ssd
  WHERE ssd.date = p_date 
    AND ssd.is_active = true
    AND p_time >= ssd.opening_time 
    AND p_time < ssd.closing_time
  LIMIT 1;

  -- Si no hay horario especial, buscar horario regular
  IF NOT FOUND THEN
    SELECT rs.max_diners, rs.opening_time, rs.closing_time
    INTO v_max_diners, v_opening, v_closing
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week 
      AND rs.is_active = true
      AND p_time >= rs.opening_time 
      AND p_time < rs.closing_time
    LIMIT 1;
  END IF;

  -- Si no hay límite configurado, permitir la reserva
  IF v_max_diners IS NULL THEN
    RETURN true;
  END IF;

  -- Calcular comensales actuales en el turno
  SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
  FROM public.reservations r
  WHERE r.date = p_date
    AND r.status IN ('confirmed', 'arrived')
    AND r.time >= v_opening 
    AND r.time < v_closing;

  -- Verificar si la nueva reserva excedería el límite
  RETURN (v_current_diners + p_guests) <= v_max_diners;
END;
$$;
