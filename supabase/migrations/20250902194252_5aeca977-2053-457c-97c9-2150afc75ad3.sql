-- Fix timezone handling in database functions
-- Update move_reservation_with_validation to handle local time correctly
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
  -- Get reservation details
  SELECT guests INTO v_guests
  FROM public.reservations
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  -- Calculate start and end times in local timezone (Europe/Madrid)
  v_start_at := (p_new_date::TEXT || ' ' || p_new_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid';
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