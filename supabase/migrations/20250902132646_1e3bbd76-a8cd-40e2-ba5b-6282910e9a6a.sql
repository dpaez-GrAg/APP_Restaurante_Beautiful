-- Add new columns to reservations table
ALTER TABLE public.reservations 
ADD COLUMN duration_minutes INTEGER DEFAULT 120,
ADD COLUMN start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN end_at TIMESTAMP WITH TIME ZONE;

-- Create reservation_table_assignments table
CREATE TABLE public.reservation_table_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reservation_id, table_id)
);

-- Enable RLS on reservation_table_assignments
ALTER TABLE public.reservation_table_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reservation_table_assignments
CREATE POLICY "Allow all for reservation table assignments" 
ON public.reservation_table_assignments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create function to update timestamps
CREATE TRIGGER update_reservation_table_assignments_updated_at
BEFORE UPDATE ON public.reservation_table_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle reservation creation with table assignment
CREATE OR REPLACE FUNCTION public.create_reservation_with_assignment(
  p_customer_id UUID,
  p_date DATE,
  p_time TIME,
  p_guests INTEGER,
  p_special_requests TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 120
)
RETURNS JSON AS $$
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
  -- Calculate start and end times
  v_start_at := (p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP WITH TIME ZONE;
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Check if restaurant is open on this day
  v_day_of_week := EXTRACT(DOW FROM p_date);
  
  -- Check for special closed days
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days 
  WHERE (
    (NOT is_range AND date = p_date) OR
    (is_range AND p_date BETWEEN range_start AND range_end)
  );
  
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;
  
  -- Check for special schedule
  SELECT opening_time, closing_time INTO v_special_schedule
  FROM public.special_schedule_days 
  WHERE date = p_date AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- Use special schedule
    IF p_time < v_special_schedule.opening_time OR p_time >= v_special_schedule.closing_time THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  ELSE
    -- Check regular schedule
    SELECT COUNT(*) > 0 INTO v_schedule_exists
    FROM public.restaurant_schedules 
    WHERE day_of_week = v_day_of_week AND is_active = true
    AND p_time >= opening_time AND p_time < closing_time;
    
    IF NOT v_schedule_exists THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  END IF;
  
  -- Find available tables with enough capacity
  v_needed_capacity := p_guests;
  v_assigned_tables := ARRAY[]::UUID[];
  v_current_capacity := 0;
  
  -- Get available tables ordered by capacity (smallest first to optimize usage)
  FOR v_table_record IN 
    SELECT t.id, t.capacity
    FROM public.tables t
    WHERE t.is_active = true
    AND t.id NOT IN (
      -- Exclude tables that have overlapping reservations
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
    ORDER BY t.capacity ASC
  LOOP
    v_assigned_tables := array_append(v_assigned_tables, v_table_record.id);
    v_current_capacity := v_current_capacity + v_table_record.capacity;
    
    -- Exit if we have enough capacity
    IF v_current_capacity >= v_needed_capacity THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Check if we found enough capacity
  IF v_current_capacity < v_needed_capacity THEN
    RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for reservations and assignments
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.reservation_table_assignments REPLICA IDENTITY FULL;