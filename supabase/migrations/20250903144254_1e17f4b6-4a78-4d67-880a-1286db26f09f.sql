-- Actualizar update_reservation_guests_with_reassignment con la lógica correcta
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
  v_combination RECORD;
BEGIN
  SELECT r.*, COALESCE(r.duration_minutes, 90) AS dur
  INTO v_reservation
  FROM public.reservations r
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found');
  END IF;

  v_duration := COALESCE(v_reservation.duration_minutes, 90);

  -- Europe/Madrid baseline
  v_start_at := ((v_reservation.date::text || ' ' || v_reservation.time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (v_duration || ' minutes')::interval;

  v_needed_capacity := p_new_guests;
  v_new_assigned_tables := ARRAY[]::uuid[];
  v_accum := 0;

  -- PASO 1: Buscar una mesa individual con capacidad suficiente
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
          ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
          AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
               + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
        )
    )
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC  -- Mesa más pequeña que cubra la necesidad
  LIMIT 1;

  IF FOUND THEN
    -- Encontramos una mesa individual que funciona
    v_new_assigned_tables := ARRAY[v_table_record.id]::uuid[];
    SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_accum
    FROM public.tables t WHERE t.id = v_table_record.id;
  ELSE
    -- PASO 2: No hay mesa individual, buscar combinaciones válidas
    FOR v_combination IN
      SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
      FROM public.table_combinations tc
      WHERE tc.is_active = true
        AND p_new_guests >= COALESCE(tc.min_capacity, 1)
        AND (tc.max_capacity IS NULL OR p_new_guests <= tc.max_capacity)
        AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_new_guests
      ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC  -- Combinación más pequeña que funcione
    LOOP
      -- Check if all tables in this combination are available
      IF NOT EXISTS (
        SELECT 1
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE rta.table_id = ANY(v_combination.table_ids)
          AND r.date = v_reservation.date
          AND r.status <> 'cancelled'
          AND r.id <> p_reservation_id
          AND (
            ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
            AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid' 
                 + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
          )
      ) THEN
        -- This combination is available
        v_new_assigned_tables := v_combination.table_ids;
        v_accum := v_combination.effective_capacity;
        EXIT;
      END IF;
    END LOOP;

    -- Si no encontramos combinación válida, la reserva no se puede realizar
    IF array_length(v_new_assigned_tables, 1) = 0 OR v_new_assigned_tables IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'No hay mesas individuales ni combinaciones disponibles para esta capacidad');
    END IF;
  END IF;

  -- Verificar que tenemos capacidad suficiente
  IF v_accum < v_needed_capacity THEN
    RETURN json_build_object('success', false, 'error', 'Not enough capacity to accommodate new guest count at this time');
  END IF;

  -- Actualizar asignaciones de mesa
  DELETE FROM public.reservation_table_assignments WHERE reservation_id = p_reservation_id;
  FOR i IN 1..array_length(v_new_assigned_tables, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (p_reservation_id, v_new_assigned_tables[i]);
  END LOOP;

  -- Actualizar reserva
  UPDATE public.reservations
  SET guests = p_new_guests, updated_at = now()
  WHERE id = p_reservation_id;

  RETURN json_build_object('success', true, 'reservation_id', p_reservation_id, 'assigned_tables', v_new_assigned_tables);
END;
$function$;