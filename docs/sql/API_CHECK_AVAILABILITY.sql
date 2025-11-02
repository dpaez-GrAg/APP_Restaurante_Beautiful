-- ========================================
-- FUNCIÓN: api_check_availability
-- ========================================
-- API pública para verificar disponibilidad con agrupación por comida/cena
-- ========================================

DROP FUNCTION IF EXISTS api_check_availability(date, integer, integer);

CREATE OR REPLACE FUNCTION api_check_availability(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week integer;
    v_lunch_slots json;
    v_dinner_slots json;
    v_lunch_open boolean := false;
    v_dinner_open boolean := false;
    v_is_closed boolean := false;
    v_lunch_start time;
    v_lunch_end time;
    v_dinner_start time;
    v_dinner_end time;
    v_current_date date;
    v_current_time time;
BEGIN
    -- Obtener fecha y hora actual
    v_current_date := CURRENT_DATE;
    v_current_time := CURRENT_TIME;
    
    -- VALIDACIÓN 1: No permitir fechas pasadas
    IF p_date < v_current_date THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se puede consultar disponibilidad en fechas pasadas',
            'date', p_date,
            'guests', p_guests
        );
    END IF;
    
    -- Obtener día de la semana (0=domingo, 6=sábado)
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Verificar si el restaurante está cerrado ese día
    SELECT EXISTS (
        SELECT 1 FROM public.special_closed_days
        WHERE date = p_date
           OR (is_range = true AND p_date BETWEEN range_start AND range_end)
    ) INTO v_is_closed;
    
    IF v_is_closed THEN
        RETURN json_build_object(
            'success', true,
            'date', p_date,
            'guests', p_guests,
            'message', 'El restaurante está cerrado en esta fecha',
            'lunch', json_build_object(
                'open', false,
                'message', 'El restaurante está cerrado en este horario',
                'slots', '[]'::json
            ),
            'dinner', json_build_object(
                'open', false,
                'message', 'El restaurante está cerrado en este horario',
                'slots', '[]'::json
            )
        );
    END IF;
    
    -- Obtener horarios del restaurante para ese día
    -- Asumimos que comida es antes de las 17:00 y cena después
    SELECT 
        CASE WHEN opening_time < '17:00' THEN opening_time ELSE NULL END,
        CASE WHEN opening_time < '17:00' THEN 
            CASE WHEN closing_time <= '17:00' THEN closing_time ELSE '17:00' END
        ELSE NULL END,
        CASE WHEN closing_time > '17:00' THEN 
            CASE WHEN opening_time >= '17:00' THEN opening_time ELSE '17:00' END
        ELSE NULL END,
        CASE WHEN closing_time > '17:00' THEN closing_time ELSE NULL END
    INTO v_lunch_start, v_lunch_end, v_dinner_start, v_dinner_end
    FROM public.restaurant_schedules
    WHERE day_of_week = v_day_of_week
      AND is_active = true
    LIMIT 1;
    
    -- Si no hay horarios configurados, el restaurante está cerrado
    IF v_lunch_start IS NULL AND v_dinner_start IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'date', p_date,
            'guests', p_guests,
            'message', 'El restaurante está cerrado en esta fecha',
            'lunch', json_build_object(
                'open', false,
                'message', 'El restaurante está cerrado en este horario',
                'slots', '[]'::json
            ),
            'dinner', json_build_object(
                'open', false,
                'message', 'El restaurante está cerrado en este horario',
                'slots', '[]'::json
            )
        );
    END IF;
    
    -- Obtener slots disponibles usando la función existente
    -- VALIDACIÓN 2: Si es hoy, filtrar slots que ya pasaron
    WITH all_slots AS (
        SELECT 
            slot_time,
            zone_name,
            zone_id,
            CASE 
                WHEN slot_time < '17:00' THEN 'lunch'
                ELSE 'dinner'
            END as service_type
        FROM get_available_time_slots_with_zones(p_date, p_guests, p_duration_minutes)
        WHERE 
            -- Si es fecha futura, mostrar todos los slots
            p_date > v_current_date
            -- Si es hoy, solo mostrar slots futuros (con 30 minutos de margen)
            OR (p_date = v_current_date AND slot_time > (v_current_time + INTERVAL '30 minutes'))
    )
    -- Agrupar slots de comida
    SELECT json_agg(
        json_build_object(
            'time', TO_CHAR(slot_time, 'HH24:MI'),
            'zone', zone_name,
            'zone_id', zone_id
        ) ORDER BY slot_time
    ) INTO v_lunch_slots
    FROM all_slots
    WHERE service_type = 'lunch';
    
    -- Agrupar slots de cena
    WITH all_slots AS (
        SELECT 
            slot_time,
            zone_name,
            zone_id,
            CASE 
                WHEN slot_time < '17:00' THEN 'lunch'
                ELSE 'dinner'
            END as service_type
        FROM get_available_time_slots_with_zones(p_date, p_guests, p_duration_minutes)
        WHERE 
            -- Si es fecha futura, mostrar todos los slots
            p_date > v_current_date
            -- Si es hoy, solo mostrar slots futuros (con 30 minutos de margen)
            OR (p_date = v_current_date AND slot_time > (v_current_time + INTERVAL '30 minutes'))
    )
    SELECT json_agg(
        json_build_object(
            'time', TO_CHAR(slot_time, 'HH24:MI'),
            'zone', zone_name,
            'zone_id', zone_id
        ) ORDER BY slot_time
    ) INTO v_dinner_slots
    FROM all_slots
    WHERE service_type = 'dinner';
    
    -- Determinar qué servicios están abiertos basándose en:
    -- 1. Si hay horarios configurados para ese rango
    -- 2. Si hay slots disponibles (esto indica que el restaurante opera en ese horario)
    v_lunch_open := (v_lunch_start IS NOT NULL) OR (v_lunch_slots IS NOT NULL);
    v_dinner_open := (v_dinner_start IS NOT NULL) OR (v_dinner_slots IS NOT NULL);
    
    -- Si no hay disponibilidad en ningún servicio
    IF (v_lunch_open AND v_lunch_slots IS NULL) AND (v_dinner_open AND v_dinner_slots IS NULL) THEN
        RETURN json_build_object(
            'success', true,
            'date', p_date,
            'guests', p_guests,
            'message', 'No hay disponibilidad para ' || p_guests || ' personas en esta fecha',
            'lunch', json_build_object(
                'open', v_lunch_open,
                'message', CASE 
                    WHEN NOT v_lunch_open THEN 'El restaurante está cerrado en este horario'
                    ELSE 'No hay disponibilidad'
                END,
                'slots', '[]'::json
            ),
            'dinner', json_build_object(
                'open', v_dinner_open,
                'message', CASE 
                    WHEN NOT v_dinner_open THEN 'El restaurante está cerrado en este horario'
                    ELSE 'No hay disponibilidad'
                END,
                'slots', '[]'::json
            )
        );
    END IF;
    
    -- Respuesta con disponibilidad
    RETURN json_build_object(
        'success', true,
        'date', p_date,
        'guests', p_guests,
        'lunch', json_build_object(
            'open', v_lunch_open,
            'message', CASE 
                WHEN NOT v_lunch_open THEN 'El restaurante está cerrado en este horario'
                WHEN v_lunch_slots IS NULL THEN 'No hay disponibilidad'
                ELSE NULL
            END,
            'slots', COALESCE(v_lunch_slots, '[]'::json)
        ),
        'dinner', json_build_object(
            'open', v_dinner_open,
            'message', CASE 
                WHEN NOT v_dinner_open THEN 'El restaurante está cerrado en este horario'
                WHEN v_dinner_slots IS NULL THEN 'No hay disponibilidad'
                ELSE NULL
            END,
            'slots', COALESCE(v_dinner_slots, '[]'::json)
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al verificar disponibilidad: ' || SQLERRM
        );
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION api_check_availability(date, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION api_check_availability(date, integer, integer) TO authenticated;

COMMENT ON FUNCTION api_check_availability IS 'API pública: Verifica disponibilidad agrupada por comida/cena para agentes externos';

-- ========================================
-- EJEMPLOS DE USO
-- ========================================

-- Ejemplo 1: Consulta básica
-- SELECT api_check_availability('2025-11-15', 4, 120);

-- Ejemplo 2: Respuesta cuando hay disponibilidad en ambos servicios
/*
{
  "success": true,
  "date": "2025-11-15",
  "guests": 4,
  "lunch": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "13:00", "zone": "Terraza", "zone_id": "uuid-terraza"},
      {"time": "13:30", "zone": "Salón Principal", "zone_id": "uuid-salon"},
      {"time": "14:00", "zone": "Terraza", "zone_id": "uuid-terraza"}
    ]
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:00", "zone": "Terraza", "zone_id": "uuid-terraza"},
      {"time": "20:30", "zone": "Comedor", "zone_id": "uuid-comedor"},
      {"time": "21:00", "zone": "Terraza", "zone_id": "uuid-terraza"}
    ]
  }
}
*/

-- Ejemplo 3: Respuesta con disponibilidad solo en cena (comida sin disponibilidad)
/*
{
  "success": true,
  "date": "2025-10-31",
  "guests": 7,
  "lunch": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:30", "zone": "Comedor", "zone_id": "uuid-comedor"},
      {"time": "21:00", "zone": "Terraza", "zone_id": "uuid-terraza"}
    ]
  }
}
*/

-- Ejemplo 4: Respuesta cuando no hay disponibilidad en ningún servicio
/*
{
  "success": true,
  "date": "2025-11-15",
  "guests": 8,
  "message": "No hay disponibilidad para 8 personas en esta fecha",
  "lunch": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  }
}
*/

-- Ejemplo 5: Respuesta cuando el restaurante está cerrado
/*
{
  "success": true,
  "date": "2025-12-25",
  "guests": 4,
  "message": "El restaurante está cerrado en esta fecha",
  "lunch": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",
    "slots": []
  },
  "dinner": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",
    "slots": []
  }
}
*/

-- Ejemplo 6: Respuesta cuando solo abre para cena (comida cerrada)
/*
{
  "success": true,
  "date": "2025-11-15",
  "guests": 4,
  "lunch": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:00", "zone": "Terraza", "zone_id": "uuid-terraza"},
      {"time": "21:00", "zone": "Comedor", "zone_id": "uuid-comedor"}
    ]
  }
}
*/
