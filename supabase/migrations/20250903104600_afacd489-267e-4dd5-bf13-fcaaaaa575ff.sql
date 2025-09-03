
-- 1) Disponibilidad: incluir capacidad efectiva (capacity + extra_capacity)
CREATE OR REPLACE FUNCTION public.get_available_time_slots(p_date date, p_guests integer, p_duration_minutes integer DEFAULT 90)
RETURNS TABLE(id uuid, slot_time time without time zone, capacity integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    v_start_at := (p_date::text || ' ' || rec.time::text)::timestamptz;
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    -- Capacidad efectiva disponible (capacity + extra_capacity)
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
            (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
            (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
            (r.start_at >= v_start_at AND r.end_at <= v_end_at)
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

-----------------------------------------------------------------------

-- 2) Crear reserva con asignación automática optimizada (mínimo nº de mesas)
CREATE OR REPLACE FUNCTION public.create_reservation_with_assignment(
  p_customer_id uuid,
  p_date date,
  p_time time without time zone,
  p_guests integer,
  p_special_requests text DEFAULT NULL::text,
  p_duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation_id UUID;
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_assigned_tables UUID[];
  v_table_record RECORD;
  v_needed_capacity INTEGER;
  v_current_capacity INTEGER;
  v_is_restaurant_open BOOLEAN;
  v_day_of_week INTEGER;
  v_schedule_exists BOOLEAN;
  v_special_closed BOOLEAN;
  v_special_schedule RECORD;
BEGIN
  v_start_at := (p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP WITH TIME ZONE;
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

  -- 2.1) Intentar una sola mesa (capacidad efectiva >= invitados), la más ajustada
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
          (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
          (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
          (r.start_at >= v_start_at AND r.end_at <= v_end_at)
        )
    )
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
  LIMIT 1;

  IF FOUND THEN
    v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
    SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
    FROM public.tables t WHERE t.id = v_table_record.id;
  ELSE
    -- 2.2) Greedy: mesas con mayor capacidad efectiva primero para minimizar nº de mesas
    FOR v_table_record IN 
      SELECT t.id, (t.capacity + COALESCE(t.extra_capacity, 0)) AS eff_cap
      FROM public.tables t
      WHERE t.is_active = true
        AND t.id NOT IN (
          SELECT rta.table_id
          FROM public.reservation_table_assignments rta
          JOIN public.reservations r ON rta.reservation_id = r.id
          WHERE r.date = p_date
            AND r.status != 'cancelled'
            AND (
              (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
              (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
              (r.start_at >= v_start_at AND r.end_at <= v_end_at)
            )
        )
      ORDER BY eff_cap DESC
    LOOP
      v_assigned_tables := array_append(v_assigned_tables, v_table_record.id);
      v_current_capacity := v_current_capacity + v_table_record.eff_cap;
      EXIT WHEN v_current_capacity >= v_needed_capacity;
    END LOOP;
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

-----------------------------------------------------------------------

-- 3) Crear con mesas específicas: validar con capacidad efectiva
CREATE OR REPLACE FUNCTION public.create_reservation_with_specific_tables(
  p_customer_id uuid,
  p_date date,
  p_time time without time zone,
  p_guests integer,
  p_special_requests text DEFAULT NULL::text,
  p_table_ids uuid[] DEFAULT NULL::uuid[],
  p_duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_start_at := (p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP WITH TIME ZONE;
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

  -- Capacidad efectiva
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
        (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
        (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
        (r.start_at >= v_start_at AND r.end_at <= v_end_at)
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

-----------------------------------------------------------------------

-- 4) Mover reserva con validaciones y asignación optimizada
CREATE OR REPLACE FUNCTION public.move_reservation_with_validation(
  p_reservation_id uuid,
  p_new_date date,
  p_new_time time without time zone,
  p_duration_minutes integer DEFAULT 90,
  p_new_table_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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
  v_guests INTEGER;
BEGIN
  SELECT guests INTO v_guests
  FROM public.reservations
  WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  -- Nota: mantener semántica local (Europe/Madrid) existente
  v_start_at := (p_new_date::TEXT || ' ' || p_new_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid';
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  v_day_of_week := EXTRACT(DOW FROM p_new_date);

  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days 
  WHERE (
    (NOT is_range AND date = p_new_date) OR
    (is_range AND p_new_date BETWEEN range_start AND range_end)
  );
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;

  SELECT opening_time, closing_time INTO v_special_schedule
  FROM public.special_schedule_days 
  WHERE date = p_new_date AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    IF p_new_time < v_special_schedule.opening_time OR p_new_time >= v_special_schedule.closing_time THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  ELSE
    SELECT COUNT(*) > 0 INTO v_schedule_exists
    FROM public.restaurant_schedules 
    WHERE day_of_week = v_day_of_week AND is_active = true
      AND p_new_time >= opening_time AND p_new_time < closing_time;
    IF NOT v_schedule_exists THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  END IF;

  IF p_new_table_ids IS NOT NULL THEN
    v_assigned_tables := p_new_table_ids;

    SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_current_capacity
    FROM public.tables t
    WHERE t.id = ANY(v_assigned_tables) AND t.is_active = true;
    IF v_current_capacity < v_guests THEN
      RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.reservation_table_assignments rta
      JOIN public.reservations r ON rta.reservation_id = r.id
      WHERE rta.table_id = ANY(v_assigned_tables)
        AND r.id != p_reservation_id
        AND r.date = p_new_date
        AND r.status != 'cancelled'
        AND (
          (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
          (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
          (r.start_at >= v_start_at AND r.end_at <= v_end_at)
        )
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Selected tables are not available at this time');
    END IF;
  ELSE
    v_needed_capacity := v_guests;
    v_assigned_tables := ARRAY[]::UUID[];
    v_current_capacity := 0;

    -- 1 mesa si es posible (más ajustada)
    SELECT t.id
    INTO v_table_record
    FROM public.tables t
    WHERE t.is_active = true
      AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
      AND t.id NOT IN (
        SELECT rta.table_id
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE r.id <> p_reservation_id
          AND r.date = p_new_date
          AND r.status != 'cancelled'
          AND (
            (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
            (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
            (r.start_at >= v_start_at AND r.end_at <= v_end_at)
          )
      )
    ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
    LIMIT 1;

    IF FOUND THEN
      v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
      SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
      FROM public.tables t WHERE t.id = v_table_record.id;
    ELSE
      -- Greedy descendente
      FOR v_table_record IN 
        SELECT t.id, (t.capacity + COALESCE(t.extra_capacity, 0)) AS eff_cap
        FROM public.tables t
        WHERE t.is_active = true
          AND t.id NOT IN (
            SELECT rta.table_id
            FROM public.reservation_table_assignments rta
            JOIN public.reservations r ON rta.reservation_id = r.id
            WHERE r.id <> p_reservation_id
              AND r.date = p_new_date
              AND r.status != 'cancelled'
              AND (
                (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
                (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
                (r.start_at >= v_start_at AND r.end_at <= v_end_at)
              )
          )
        ORDER BY eff_cap DESC
      LOOP
        v_assigned_tables := array_append(v_assigned_tables, v_table_record.id);
        v_current_capacity := v_current_capacity + v_table_record.eff_cap;
        EXIT WHEN v_current_capacity >= v_needed_capacity;
      END LOOP;

      IF v_current_capacity < v_needed_capacity THEN
        RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
      END IF;
    END IF;
  END IF;

  UPDATE public.reservations
  SET 
    date = p_new_date,
    time = p_new_time,
    duration_minutes = p_duration_minutes,
    start_at = v_start_at,
    end_at = v_end_at,
    updated_at = now()
  WHERE id = p_reservation_id;

  DELETE FROM public.reservation_table_assignments WHERE reservation_id = p_reservation_id;

  FOR i IN 1..array_length(v_assigned_tables, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (p_reservation_id, v_assigned_tables[i]);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'assigned_tables', v_assigned_tables
  );
END;
$function$;

-----------------------------------------------------------------------

-- 5) Reasignación al cambiar nº de comensales (minimizar nº de mesas)
CREATE OR REPLACE FUNCTION public.update_reservation_guests_with_reassignment(
  p_reservation_id uuid,
  p_new_guests integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation RECORD;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_assigned_tables uuid[];
  v_table_record RECORD;
  v_needed_capacity integer;
  v_new_assigned_tables uuid[];
  v_duration integer;
  v_accum integer;
BEGIN
  SELECT r.*, COALESCE(r.duration_minutes, 90) AS dur
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  v_duration := COALESCE(v_reservation.duration_minutes, 90);

  v_start_at := (v_reservation.date::text || ' ' || v_reservation.time::text)::timestamptz;
  v_end_at := v_start_at + (v_duration || ' minutes')::interval;

  v_needed_capacity := p_new_guests;
  v_new_assigned_tables := ARRAY[]::uuid[];
  v_accum := 0;

  -- 1 mesa si es posible
  SELECT t.id
  INTO v_table_record
  FROM public.tables t
  WHERE t.is_active = true
    AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
    AND t.id NOT IN (
      SELECT rta.table_id
      FROM public.reservation_table_assignments rta
      JOIN public.reservations r ON rta.reservation_id = r.id
      WHERE r.date = v_reservation.date
        AND r.status <> 'cancelled'
        AND r.id <> p_reservation_id
        AND (
          (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
          (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
          (r.start_at >= v_start_at AND r.end_at <= v_end_at)
        )
    )
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
  LIMIT 1;

  IF FOUND THEN
    v_new_assigned_tables := ARRAY[v_table_record.id]::uuid[];
    SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_accum
    FROM public.tables t WHERE t.id = v_table_record.id;
  ELSE
    -- Greedy descendente
    FOR v_table_record IN
      SELECT t.id, (t.capacity + COALESCE(t.extra_capacity, 0)) AS eff_cap
      FROM public.tables t
      WHERE t.is_active = true
        AND t.id NOT IN (
          SELECT rta.table_id
          FROM public.reservation_table_assignments rta
          JOIN public.reservations r ON rta.reservation_id = r.id
          WHERE r.date = v_reservation.date
            AND r.status <> 'cancelled'
            AND r.id <> p_reservation_id
            AND (
              (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
              (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
              (r.start_at >= v_start_at AND r.end_at <= v_end_at)
            )
        )
      ORDER BY eff_cap DESC
    LOOP
      v_new_assigned_tables := array_append(v_new_assigned_tables, v_table_record.id);
      v_accum := v_accum + v_table_record.eff_cap;
      EXIT WHEN v_accum >= v_needed_capacity;
    END LOOP;

    IF v_accum < v_needed_capacity THEN
      RETURN json_build_object('success', false, 'error', 'Not enough capacity to accommodate new guest count at this time');
    END IF;
  END IF;

  DELETE FROM public.reservation_table_assignments WHERE reservation_id = p_reservation_id;
  FOR i IN 1..array_length(v_new_assigned_tables, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (p_reservation_id, v_new_assigned_tables[i]);
  END LOOP;

  UPDATE public.reservations
  SET guests = p_new_guests, updated_at = now()
  WHERE id = p_reservation_id;

  RETURN json_build_object('success', true, 'reservation_id', p_reservation_id, 'assigned_tables', v_new_assigned_tables);
END;
$function$;
