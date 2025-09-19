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
