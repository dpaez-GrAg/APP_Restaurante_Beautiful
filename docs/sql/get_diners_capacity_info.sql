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
