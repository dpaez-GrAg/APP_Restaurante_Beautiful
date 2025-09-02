-- Create function to update guests with auto table reassignment if needed
CREATE OR REPLACE FUNCTION public.update_reservation_guests_with_reassignment(
  p_reservation_id uuid,
  p_new_guests integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_current_capacity integer;
  v_assigned_tables uuid[];
  v_table_record RECORD;
  v_needed_capacity integer;
  v_new_assigned_tables uuid[];
  v_duration integer;
BEGIN
  -- Load reservation basics
  SELECT r.*, COALESCE(r.duration_minutes, 90) AS dur
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  v_duration := COALESCE(v_reservation.duration_minutes, 90);

  -- Compute time window using local timestamp semantics (same as other functions)
  v_start_at := (v_reservation.date::text || ' ' || v_reservation.time::text)::timestamptz;
  v_end_at := v_start_at + (v_duration || ' minutes')::interval;

  -- Current assignments and capacity
  SELECT array_agg(rta.table_id) INTO v_assigned_tables
  FROM public.reservation_table_assignments rta
  WHERE rta.reservation_id = p_reservation_id;

  SELECT COALESCE(SUM(t.capacity), 0) INTO v_current_capacity
  FROM public.tables t
  WHERE t.is_active = true AND t.id = ANY(COALESCE(v_assigned_tables, ARRAY[]::uuid[]));

  -- If current assignment can hold the new guest count, just update guests
  IF v_current_capacity >= p_new_guests THEN
    UPDATE public.reservations
    SET guests = p_new_guests, updated_at = now()
    WHERE id = p_reservation_id;

    RETURN json_build_object('success', true, 'reservation_id', p_reservation_id, 'assigned_tables', v_assigned_tables);
  END IF;

  -- Find new set of available tables for the same time window
  v_needed_capacity := p_new_guests;
  v_new_assigned_tables := ARRAY[]::uuid[];
  v_current_capacity := 0;

  FOR v_table_record IN
    SELECT t.id, t.capacity
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
    ORDER BY t.capacity ASC
  LOOP
    v_new_assigned_tables := array_append(v_new_assigned_tables, v_table_record.id);
    v_current_capacity := v_current_capacity + v_table_record.capacity;
    EXIT WHEN v_current_capacity >= v_needed_capacity;
  END LOOP;

  IF v_current_capacity < v_needed_capacity THEN
    RETURN json_build_object('success', false, 'error', 'Not enough capacity to accommodate new guest count at this time');
  END IF;

  -- Replace assignments atomically
  DELETE FROM public.reservation_table_assignments WHERE reservation_id = p_reservation_id;
  FOR i IN 1..array_length(v_new_assigned_tables, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (p_reservation_id, v_new_assigned_tables[i]);
  END LOOP;

  -- Update guests
  UPDATE public.reservations
  SET guests = p_new_guests, updated_at = now()
  WHERE id = p_reservation_id;

  RETURN json_build_object('success', true, 'reservation_id', p_reservation_id, 'assigned_tables', v_new_assigned_tables);
END;
$$;