-- Actualizar la función move_reservation_with_validation para respetar combinaciones de mesas
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
  v_current_table_ids UUID[];
  v_combination RECORD;
BEGIN
  -- Get current reservation details
  SELECT guests, 
         ARRAY(SELECT rta.table_id FROM reservation_table_assignments rta WHERE rta.reservation_id = p_reservation_id)
  INTO v_guests, v_current_table_ids
  FROM public.reservations
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  -- Europe/Madrid baseline
  v_start_at := ((p_new_date::TEXT || ' ' || p_new_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  v_day_of_week := EXTRACT(DOW FROM p_new_date);

  -- Check if restaurant is closed
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days 
  WHERE (
    (NOT is_range AND date = p_new_date) OR
    (is_range AND p_new_date BETWEEN range_start AND range_end)
  );
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;

  -- Check opening hours
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

  -- Handle table assignment
  IF p_new_table_ids IS NOT NULL THEN
    -- Use specific tables provided - validate they form a valid combination
    v_assigned_tables := p_new_table_ids;

    -- Check if the provided tables form a valid combination
    IF NOT EXISTS (
      SELECT 1
      FROM public.table_combinations tc
      WHERE tc.is_active = true
        AND tc.table_ids = p_new_table_ids
    ) THEN
      -- If not a valid combination, check individual table capacity
      SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_current_capacity
      FROM public.tables t
      WHERE t.id = ANY(v_assigned_tables) AND t.is_active = true;
    ELSE
      -- It's a valid combination, get the combination capacity
      SELECT tc.total_capacity + COALESCE(tc.extra_capacity, 0) INTO v_current_capacity
      FROM public.table_combinations tc
      WHERE tc.is_active = true AND tc.table_ids = p_new_table_ids
      LIMIT 1;
    END IF;
    
    IF v_current_capacity < v_guests THEN
      RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
    END IF;

    -- Check if selected tables are available (excluding current reservation)
    IF EXISTS (
      SELECT 1
      FROM public.reservation_table_assignments rta
      JOIN public.reservations r ON rta.reservation_id = r.id
      WHERE rta.table_id = ANY(v_assigned_tables)
        AND r.id != p_reservation_id
        AND r.date = p_new_date
        AND r.status != 'cancelled'
        AND (
          ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
          AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
               + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
        )
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Selected tables are not available at this time');
    END IF;
  ELSE
    -- Auto-assign tables - prioritize combinations
    v_needed_capacity := v_guests;
    v_assigned_tables := ARRAY[]::UUID[];
    v_current_capacity := 0;

    -- First, try to find a suitable table combination
    FOR v_combination IN
      SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
      FROM public.table_combinations tc
      WHERE tc.is_active = true
        AND v_guests >= COALESCE(tc.min_capacity, 1)
        AND (tc.max_capacity IS NULL OR v_guests <= tc.max_capacity)
        AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= v_guests
      ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC
    LOOP
      -- Check if all tables in this combination are available
      IF NOT EXISTS (
        SELECT 1
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE rta.table_id = ANY(v_combination.table_ids)
          AND r.id != p_reservation_id
          AND r.date = p_new_date
          AND r.status != 'cancelled'
          AND (
            ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
            AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                 + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
          )
      ) THEN
        -- This combination is available
        v_assigned_tables := v_combination.table_ids;
        v_current_capacity := v_combination.effective_capacity;
        EXIT;
      END IF;
    END LOOP;

    -- If no combination worked, try individual tables
    IF array_length(v_assigned_tables, 1) = 0 OR v_assigned_tables IS NULL THEN
      v_current_capacity := 0;
      
      -- Try single table first
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
              ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
            )
        )
      ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
      LIMIT 1;

      IF FOUND THEN
        v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
        SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
        FROM public.tables t WHERE t.id = v_table_record.id;
      ELSE
        -- Greedy approach: multiple tables
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
                  ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
                  AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                       + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
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
    END IF;
  END IF;

  -- Update reservation
  UPDATE public.reservations
  SET 
    date = p_new_date,
    time = p_new_time,
    duration_minutes = p_duration_minutes,
    start_at = v_start_at,
    end_at = v_end_at,
    updated_at = now()
  WHERE id = p_reservation_id;

  -- Update table assignments
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