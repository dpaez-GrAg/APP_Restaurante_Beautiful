
-- 1) Asegurar claves foráneas para que las asignaciones se relacionen con reservas y mesas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rta_reservation_fk'
  ) THEN
    ALTER TABLE public.reservation_table_assignments
      ADD CONSTRAINT rta_reservation_fk
      FOREIGN KEY (reservation_id)
      REFERENCES public.reservations(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rta_table_fk'
  ) THEN
    ALTER TABLE public.reservation_table_assignments
      ADD CONSTRAINT rta_table_fk
      FOREIGN KEY (table_id)
      REFERENCES public.tables(id)
      ON DELETE RESTRICT;
  END IF;
END$$;

-- Índices útiles para rendimiento
CREATE INDEX IF NOT EXISTS idx_reservations_date_status
  ON public.reservations(date, status);

CREATE INDEX IF NOT EXISTS idx_rta_reservation_id
  ON public.reservation_table_assignments(reservation_id);

CREATE INDEX IF NOT EXISTS idx_tables_is_active
  ON public.tables(is_active);

-- 2) Función para obtener horarios disponibles (considera horarios, cierres y capacidad real)
CREATE OR REPLACE FUNCTION public.get_available_time_slots(
  p_date date,
  p_guests integer,
  p_duration_minutes integer DEFAULT 120
)
RETURNS TABLE(id uuid, time time without time zone, capacity integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_day_of_week int;
  v_slot_id uuid;
  v_slot_time time without time zone;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Si el día está cerrado (día especial cerrado o rango), no devolvemos nada
  IF EXISTS (
    SELECT 1
    FROM public.special_closed_days scd
    WHERE (NOT scd.is_range AND scd.date = p_date)
       OR (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
  ) THEN
    RETURN;
  END IF;

  -- Seleccionar slots válidos según horario especial del día o, si no lo hay, el horario regular de ese día de la semana
  FOR v_slot_id, v_slot_time IN
    WITH active_windows AS (
      -- Si hay un horario especial activo para la fecha, usarlo
      SELECT opening_time, closing_time
      FROM public.special_schedule_days
      WHERE date = p_date AND is_active = true

      UNION ALL

      -- Si NO hay horario especial, usar las ventanas regulares del día
      SELECT rs.opening_time, rs.closing_time
      FROM public.restaurant_schedules rs
      WHERE rs.is_active = true
        AND rs.day_of_week = v_day_of_week
        AND NOT EXISTS (
          SELECT 1 FROM public.special_schedule_days ssd
          WHERE ssd.date = p_date AND ssd.is_active = true
        )
    ),
    valid_slots AS (
      SELECT ts.id, ts.time
      FROM public.time_slots ts
      JOIN active_windows w
        ON ts.time >= w.opening_time AND ts.time < w.closing_time
    )
    SELECT id, time
    FROM valid_slots
    ORDER BY time
  LOOP
    -- Para cada slot, calcular capacidad disponible real
    RETURN QUERY
    WITH sb AS (
      SELECT
        (p_date::text || ' ' || v_slot_time::text)::timestamptz AS start_at,
        ((p_date::text || ' ' || v_slot_time::text)::timestamptz + make_interval(mins => p_duration_minutes)) AS end_at
    ),
    overlapping_reservations AS (
      SELECT r.id
      FROM public.reservations r, sb
      WHERE r.date = p_date
        AND r.status <> 'cancelled'
        AND (
          -- reconstruir start/end si son nulos
          COALESCE(r.start_at, (r.date::text || ' ' || r.time::text)::timestamptz) <= sb.start_at AND
          COALESCE(r.end_at,   (r.date::text || ' ' || r.time::text)::timestamptz + make_interval(mins => COALESCE(r.duration_minutes, 120))) > sb.start_at
          OR
          COALESCE(r.start_at, (r.date::text || ' ' || r.time::text)::timestamptz) < sb.end_at  AND
          COALESCE(r.end_at,   (r.date::text || ' ' || r.time::text)::timestamptz + make_interval(mins => COALESCE(r.duration_minutes, 120))) >= sb.end_at
          OR
          COALESCE(r.start_at, (r.date::text || ' ' || r.time::text)::timestamptz) >= sb.start_at AND
          COALESCE(r.end_at,   (r.date::text || ' ' || r.time::text)::timestamptz + make_interval(mins => COALESCE(r.duration_minutes, 120))) <= sb.end_at
        )
    ),
    unassigned_exists AS (
      -- si hay alguna reserva solapada sin asignación de mesa, mejor marcar el slot como no disponible
      SELECT EXISTS (
        SELECT 1
        FROM overlapping_reservations o
        LEFT JOIN public.reservation_table_assignments rta
          ON rta.reservation_id = o.id
        WHERE rta.reservation_id IS NULL
      ) AS flag
    ),
    occupied_tables AS (
      SELECT DISTINCT rta.table_id
      FROM public.reservation_table_assignments rta
      JOIN overlapping_reservations o ON o.id = rta.reservation_id
    ),
    available AS (
      SELECT
        CASE
          WHEN (SELECT flag FROM unassigned_exists) THEN 0
          ELSE COALESCE(SUM(t.capacity), 0)
        END AS total_capacity
      FROM public.tables t
      WHERE t.is_active = true
        AND t.id NOT IN (SELECT table_id FROM occupied_tables)
    )
    SELECT v_slot_id, v_slot_time, (SELECT total_capacity FROM available) AS capacity
    WHERE (SELECT total_capacity FROM available) >= p_guests;
  END LOOP;

END;
$function$;

-- Permisos de ejecución (por si hiciera falta)
GRANT EXECUTE ON FUNCTION public.get_available_time_slots(date, integer, integer) TO anon, authenticated;
