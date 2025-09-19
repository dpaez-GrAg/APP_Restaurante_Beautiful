-- ========================================
-- FUNCIÓN CORREGIDA: GET AVAILABLE TIME SLOTS
-- ========================================
-- Esta función corrige los problemas de lógica para verificar disponibilidad

DROP FUNCTION IF EXISTS get_available_time_slots(date, integer, integer);

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
  FOR v_schedule_record IN
    SELECT ssd.opening_time, ssd.closing_time, ssd.max_diners
    FROM public.special_schedule_days ssd
    WHERE ssd.date = p_date AND ssd.is_active = true
    ORDER BY ssd.opening_time
  LOOP
    -- Procesar cada horario especial
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

      -- Calcular capacidad disponible por mesas (excluyendo mesas ocupadas)
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
              -- Verificar solapamiento de horarios más preciso
              (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at)
              AND
              (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at)
            )
        );

      -- Calcular comensales actuales en el turno (si hay límite configurado)
      v_current_diners := 0;
      IF v_schedule_record.max_diners IS NOT NULL THEN
        SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
        FROM public.reservations r
        WHERE r.date = p_date
          AND r.status IN ('confirmed', 'arrived', 'seated')
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

  -- Si no hay horarios especiales, usar horarios regulares
  IF NOT FOUND THEN
    FOR v_schedule_record IN
      SELECT rs.opening_time, rs.closing_time, rs.max_diners
      FROM public.restaurant_schedules rs
      WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
      ORDER BY rs.opening_time
    LOOP
      -- Procesar cada horario regular
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

        -- Calcular capacidad disponible por mesas (excluyendo mesas ocupadas)
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
                -- Verificar solapamiento de horarios más preciso
                (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at)
                AND
                (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                  + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at)
              )
          );

        -- Calcular comensales actuales en el turno (si hay límite configurado)
        v_current_diners := 0;
        IF v_schedule_record.max_diners IS NOT NULL THEN
          SELECT COALESCE(SUM(r.guests), 0) INTO v_current_diners
          FROM public.reservations r
          WHERE r.date = p_date
            AND r.status IN ('confirmed', 'arrived', 'seated')
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
  END IF;

  RETURN;
END;
$$;

-- Función de debugging para verificar reservas existentes
CREATE OR REPLACE FUNCTION debug_reservations_for_date(
  p_date date
)
RETURNS TABLE(
  reservation_id uuid,
  customer_name text,
  reservation_time time,
  guests integer,
  status text,
  assigned_tables text[],
  duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    c.name,
    r.time,
    r.guests,
    r.status,
    ARRAY_AGG(t.name ORDER BY t.name) as table_names,
    r.duration_minutes
  FROM public.reservations r
  JOIN public.customers c ON r.customer_id = c.id
  LEFT JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
  LEFT JOIN public.tables t ON rta.table_id = t.id
  WHERE r.date = p_date
    AND r.status IN ('confirmed', 'arrived', 'seated')
  GROUP BY r.id, c.name, r.time, r.guests, r.status, r.duration_minutes
  ORDER BY r.time;
END;
$$;

COMMENT ON FUNCTION get_available_time_slots IS 'Función corregida que verifica disponibilidad considerando reservas existentes y límites de comensales';
COMMENT ON FUNCTION debug_reservations_for_date IS 'Función de debugging para ver reservas existentes en una fecha';
