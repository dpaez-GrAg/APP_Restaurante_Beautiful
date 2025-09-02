-- Create RPC to list available time slots for a given date and guests
CREATE OR REPLACE FUNCTION public.get_available_time_slots(
  p_date date,
  p_guests integer,
  p_duration_minutes integer DEFAULT 120
)
RETURNS TABLE (
  id uuid,
  time time without time zone,
  capacity integer
)
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
  -- Determine weekday
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Check special closed days (single or range)
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days scd
  WHERE (
    (NOT scd.is_range AND scd.date = p_date) OR
    (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
  );

  IF v_special_closed THEN
    RETURN; -- No slots if closed
  END IF;

  -- Prefer special schedule when present
  SELECT ssd.opening_time, ssd.closing_time
  INTO v_opening, v_closing
  FROM public.special_schedule_days ssd
  WHERE ssd.date = p_date AND ssd.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    -- Fallback to regular schedule for the weekday
    SELECT rs.opening_time, rs.closing_time
    INTO v_opening, v_closing
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
    LIMIT 1;

    -- If no schedule, return empty
    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Iterate through configured time slots within open hours
  FOR rec IN
    SELECT ts.id, ts.time, ts.max_capacity
    FROM public.time_slots ts
    WHERE ts.time >= v_opening AND ts.time < v_closing
    ORDER BY ts.time
  LOOP
    v_start_at := (p_date::text || ' ' || rec.time::text)::timestamptz;
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    -- Sum capacity of free, active tables for the interval
    SELECT COALESCE(SUM(t.capacity), 0) INTO v_available_capacity
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
      time := rec.time;
      capacity := LEAST(v_available_capacity, rec.max_capacity);
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;