-- ========================================
-- NUEVA FUNCIÓN: SLOTS DISPONIBLES CON INFORMACIÓN DE ZONA
-- Para mostrar disponibilidad agrupada por zona en el frontend público
-- ========================================

DROP FUNCTION IF EXISTS public.get_available_time_slots_with_zones(date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_available_time_slots_with_zones(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 90
)
RETURNS TABLE(
    id uuid, 
    slot_time time, 
    capacity integer, 
    zone_id uuid,
    zone_name text,
    zone_color text,
    zone_priority integer,
    is_normalized boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week integer;
    v_special_closed boolean;
    v_total_capacity integer;
BEGIN
    -- Obtener día de la semana
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Verificar si es un día especial cerrado
    SELECT COUNT(*) > 0 INTO v_special_closed
    FROM public.special_closed_days scd
    WHERE (
        (NOT scd.is_range AND scd.date = p_date) OR
        (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
    );

    -- Si está cerrado, no devolver slots
    IF v_special_closed THEN
        RETURN;
    END IF;

    -- Calcular capacidad total del restaurante
    SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0)
    INTO v_total_capacity
    FROM public.tables t
    WHERE t.is_active = true;

    -- Si no hay capacidad suficiente en todo el restaurante, no devolver slots
    IF v_total_capacity < p_guests THEN
        RETURN;
    END IF;

    -- Devolver TODOS los slots disponibles con información de zona
    RETURN QUERY
    WITH slot_times AS (
        SELECT ts.time as slot_time
        FROM public.time_slots ts
        WHERE EXISTS (
            SELECT 1 FROM public.restaurant_schedules rs
            WHERE rs.day_of_week = v_day_of_week 
              AND rs.is_active = true
              AND ts.time >= rs.opening_time 
              AND ts.time < rs.closing_time
        )
    ),
    slot_ranges AS (
        SELECT 
            st.slot_time,
            ((p_date::text || ' ' || st.slot_time::text)::timestamp AT TIME ZONE 'Europe/Madrid') as start_at,
            ((p_date::text || ' ' || st.slot_time::text)::timestamp AT TIME ZONE 'Europe/Madrid') + (p_duration_minutes || ' minutes')::interval as end_at
        FROM slot_times st
    ),
    -- Obtener TODAS las mesas ocupadas para TODOS los slots de una vez
    occupied_tables AS (
        SELECT DISTINCT
            sr.slot_time,
            rta.table_id
        FROM slot_ranges sr
        CROSS JOIN public.reservations r
        INNER JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
        WHERE r.date = p_date
          AND r.status IN ('confirmed', 'arrived')
          AND r.start_at < sr.end_at 
          AND r.end_at > sr.start_at
    ),
    -- Mesas individuales disponibles (con información de zona)
    single_tables_available AS (
        SELECT 
            sr.slot_time,
            t.id as table_id,
            (t.capacity + COALESCE(t.extra_capacity, 0)) as table_capacity,
            t.zone_id,
            COALESCE(z.name, 'Sin zona') as zone_name,
            COALESCE(z.color, '#6B7280') as zone_color,
            COALESCE(z.priority_order, 999) as zone_priority
        FROM slot_ranges sr
        CROSS JOIN public.tables t
        LEFT JOIN public.zones z ON t.zone_id = z.id
        WHERE t.is_active = true
          AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= p_guests
          AND NOT EXISTS (
              SELECT 1 FROM occupied_tables ot
              WHERE ot.slot_time = sr.slot_time
                AND ot.table_id = t.id
          )
    ),
    -- Combinaciones disponibles (con información de zona)
    combinations_available AS (
        SELECT 
            sr.slot_time,
            tc.id as combination_id,
            (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) as combination_capacity,
            tc.zone_id,
            COALESCE(z.name, 'Sin zona') as zone_name,
            COALESCE(z.color, '#6B7280') as zone_color,
            COALESCE(z.priority_order, 999) as zone_priority
        FROM slot_ranges sr
        CROSS JOIN public.table_combinations tc
        LEFT JOIN public.zones z ON tc.zone_id = z.id
        WHERE tc.is_active = true
          AND p_guests >= COALESCE(tc.min_capacity, 1)
          AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
          AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
          -- CRÍTICO: Verificar que TODAS las mesas de la combinación están activas
          AND (
              SELECT bool_and(t.is_active)
              FROM unnest(tc.table_ids) AS tid
              JOIN public.tables t ON t.id = tid
          )
          -- Verificar que ninguna mesa está ocupada
          AND NOT EXISTS (
              SELECT 1 
              FROM unnest(tc.table_ids) AS tid
              WHERE EXISTS (
                  SELECT 1 FROM occupied_tables ot
                  WHERE ot.slot_time = sr.slot_time
                    AND ot.table_id = tid
              )
          )
    ),
    -- Unir mesas y combinaciones
    all_options_available AS (
        SELECT 
            sta.slot_time,
            sta.table_capacity as capacity,
            sta.zone_id,
            sta.zone_name,
            sta.zone_color,
            sta.zone_priority
        FROM single_tables_available sta
        UNION ALL
        SELECT 
            ca.slot_time,
            ca.combination_capacity as capacity,
            ca.zone_id,
            ca.zone_name,
            ca.zone_color,
            ca.zone_priority
        FROM combinations_available ca
    ),
    -- Para cada combinación slot + zona, obtener la mejor opción (menor capacidad)
    best_option_per_slot_zone AS (
        SELECT DISTINCT ON (aoa.slot_time, aoa.zone_id)
            aoa.slot_time,
            aoa.capacity,
            aoa.zone_id,
            aoa.zone_name,
            aoa.zone_color,
            aoa.zone_priority
        FROM all_options_available aoa
        ORDER BY aoa.slot_time, aoa.zone_id, aoa.capacity ASC
    )
    SELECT 
        gen_random_uuid() as id,
        bopsz.slot_time,
        bopsz.capacity::integer as capacity,
        bopsz.zone_id,
        bopsz.zone_name,
        bopsz.zone_color,
        bopsz.zone_priority,
        true as is_normalized
    FROM best_option_per_slot_zone bopsz
    ORDER BY bopsz.slot_time, bopsz.zone_priority
    LIMIT 500;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.get_available_time_slots_with_zones(date, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_time_slots_with_zones(date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_time_slots_with_zones(date, integer, integer) TO service_role;

-- Comentario
COMMENT ON FUNCTION public.get_available_time_slots_with_zones IS 'Devuelve todos los slots disponibles con información de zona para mostrar agrupados en el frontend público';
