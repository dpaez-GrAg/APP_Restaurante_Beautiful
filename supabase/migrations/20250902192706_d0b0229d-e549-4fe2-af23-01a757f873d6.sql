-- RPC function to move reservation with validation
CREATE OR REPLACE FUNCTION public.move_reservation_with_validation(
  p_reservation_id uuid,
  p_new_date date,
  p_new_time time without time zone,
  p_new_table_ids uuid[] DEFAULT NULL,
  p_duration_minutes integer DEFAULT 90
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
  -- Get reservation details
  SELECT guests INTO v_guests
  FROM public.reservations
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  -- Calculate start and end times
  v_start_at := (p_new_date::TEXT || ' ' || p_new_time::TEXT)::TIMESTAMP WITH TIME ZONE;
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Check if restaurant is open on this day
  v_day_of_week := EXTRACT(DOW FROM p_new_date);
  
  -- Check for special closed days
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days 
  WHERE (
    (NOT is_range AND date = p_new_date) OR
    (is_range AND p_new_date BETWEEN range_start AND range_end)
  );
  
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;
  
  -- Check for special schedule
  SELECT opening_time, closing_time INTO v_special_schedule
  FROM public.special_schedule_days 
  WHERE date = p_new_date AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- Use special schedule
    IF p_new_time < v_special_schedule.opening_time OR p_new_time >= v_special_schedule.closing_time THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  ELSE
    -- Check regular schedule
    SELECT COUNT(*) > 0 INTO v_schedule_exists
    FROM public.restaurant_schedules 
    WHERE day_of_week = v_day_of_week AND is_active = true
    AND p_new_time >= opening_time AND p_new_time < closing_time;
    
    IF NOT v_schedule_exists THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  END IF;
  
  -- Use provided tables or find available ones
  IF p_new_table_ids IS NOT NULL THEN
    v_assigned_tables := p_new_table_ids;
    
    -- Check capacity of provided tables
    SELECT COALESCE(SUM(t.capacity), 0) INTO v_current_capacity
    FROM public.tables t
    WHERE t.id = ANY(v_assigned_tables) AND t.is_active = true;
    
    IF v_current_capacity < v_guests THEN
      RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
    END IF;
    
    -- Check if tables are available (excluding current reservation)
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
    -- Find available tables automatically
    v_needed_capacity := v_guests;
    v_assigned_tables := ARRAY[]::UUID[];
    v_current_capacity := 0;
    
    FOR v_table_record IN 
      SELECT t.id, t.capacity
      FROM public.tables t
      WHERE t.is_active = true
      AND t.id NOT IN (
        SELECT rta.table_id
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE r.id != p_reservation_id
        AND r.date = p_new_date
        AND r.status != 'cancelled'
        AND (
          (r.start_at <= v_start_at AND r.end_at > v_start_at) OR
          (r.start_at < v_end_at AND r.end_at >= v_end_at) OR
          (r.start_at >= v_start_at AND r.end_at <= v_end_at)
        )
      )
      ORDER BY t.capacity ASC
    LOOP
      v_assigned_tables := array_append(v_assigned_tables, v_table_record.id);
      v_current_capacity := v_current_capacity + v_table_record.capacity;
      
      IF v_current_capacity >= v_needed_capacity THEN
        EXIT;
      END IF;
    END LOOP;
    
    IF v_current_capacity < v_needed_capacity THEN
      RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
    END IF;
  END IF;
  
  -- Update the reservation
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

-- RPC function to update reservation details
CREATE OR REPLACE FUNCTION public.update_reservation_details(
  p_reservation_id uuid,
  p_guests integer DEFAULT NULL,
  p_special_requests text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_capacity INTEGER;
  v_assigned_tables UUID[];
BEGIN
  -- If updating guests, check table capacity
  IF p_guests IS NOT NULL THEN
    SELECT array_agg(rta.table_id) INTO v_assigned_tables
    FROM public.reservation_table_assignments rta
    WHERE rta.reservation_id = p_reservation_id;
    
    SELECT COALESCE(SUM(t.capacity), 0) INTO v_current_capacity
    FROM public.tables t
    WHERE t.id = ANY(v_assigned_tables) AND t.is_active = true;
    
    IF v_current_capacity < p_guests THEN
      RETURN json_build_object('success', false, 'error', 'Current table assignment does not have enough capacity for the new guest count');
    END IF;
  END IF;
  
  -- Update the reservation
  UPDATE public.reservations
  SET 
    guests = COALESCE(p_guests, guests),
    special_requests = COALESCE(p_special_requests, special_requests),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;
  
  RETURN json_build_object('success', true, 'reservation_id', p_reservation_id);
END;
$function$;

-- RPC function to create admin reservation
CREATE OR REPLACE FUNCTION public.admin_create_reservation(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text DEFAULT NULL,
  p_date date,
  p_time time without time zone,
  p_guests integer,
  p_special_requests text DEFAULT NULL,
  p_table_ids uuid[] DEFAULT NULL,
  p_duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id UUID;
  v_reservation_result JSON;
BEGIN
  -- Create or get customer
  INSERT INTO public.customers (name, email, phone)
  VALUES (p_customer_name, p_customer_email, p_customer_phone)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    updated_at = now()
  RETURNING id INTO v_customer_id;
  
  -- Create reservation with specific tables or auto-assignment
  IF p_table_ids IS NOT NULL THEN
    SELECT public.create_reservation_with_specific_tables(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_table_ids, p_duration_minutes
    ) INTO v_reservation_result;
  ELSE
    SELECT public.create_reservation_with_assignment(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
    ) INTO v_reservation_result;
  END IF;
  
  RETURN v_reservation_result;
END;
$function$;

-- Helper function for specific table assignment
CREATE OR REPLACE FUNCTION public.create_reservation_with_specific_tables(
  p_customer_id uuid,
  p_date date,
  p_time time without time zone,
  p_guests integer,
  p_special_requests text DEFAULT NULL,
  p_table_ids uuid[],
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
  -- Calculate start and end times
  v_start_at := (p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP WITH TIME ZONE;
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Validate restaurant is open (same validation as other functions)
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
  
  -- Check table capacity
  SELECT COALESCE(SUM(t.capacity), 0) INTO v_current_capacity
  FROM public.tables t
  WHERE t.id = ANY(p_table_ids) AND t.is_active = true;
  
  IF v_current_capacity < p_guests THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
  END IF;
  
  -- Check table availability
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
  
  -- Create the reservation
  INSERT INTO public.reservations (
    customer_id, date, time, guests, special_requests, 
    status, duration_minutes, start_at, end_at
  )
  VALUES (
    p_customer_id, p_date, p_time, p_guests, p_special_requests, 
    'confirmed', p_duration_minutes, v_start_at, v_end_at
  )
  RETURNING id INTO v_reservation_id;
  
  -- Create table assignments
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