-- ========================================
-- API FUNCTION: CHECK AVAILABILITY WITH CAPACITY LIMITS (FIXED)
-- ========================================
-- Esta función verifica disponibilidad considerando:
-- 1. Disponibilidad de mesas
-- 2. Límites de comensales por turno
-- 3. Información de capacidad actual vs máxima

-- Primero eliminar las funciones existentes
DROP FUNCTION IF EXISTS api_check_availability_with_capacity(date, integer, integer);
DROP FUNCTION IF EXISTS api_check_availability(date, integer, integer);

CREATE OR REPLACE FUNCTION api_check_availability_with_capacity(
  date date,
  guests integer,
  duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week integer;
  v_special_closed boolean;
  v_available_slots json[];
  v_capacity_info json[];
  v_result json;
  v_total_available_slots integer;
  v_has_capacity_limits boolean;
  slot_record record;
  capacity_record record;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM date);
  v_available_slots := ARRAY[]::json[];
  v_capacity_info := ARRAY[]::json[];
  v_total_available_slots := 0;
  v_has_capacity_limits := false;

  -- Verificar si es un día especial cerrado
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days scd
  WHERE (
    (NOT scd.is_range AND scd.date = api_check_availability_with_capacity.date) OR
    (scd.is_range AND api_check_availability_with_capacity.date BETWEEN scd.range_start AND scd.range_end)
  );

  IF v_special_closed THEN
    v_result := json_build_object(
      'available', false,
      'reason', 'Restaurant is closed on this date',
      'available_slots', ARRAY[]::json[],
      'capacity_info', ARRAY[]::json[],
      'total_slots', 0,
      'has_capacity_limits', false
    );
    RETURN v_result;
  END IF;

  -- Obtener slots disponibles usando la función actualizada
  FOR slot_record IN
    SELECT * FROM get_available_time_slots(
      api_check_availability_with_capacity.date, 
      api_check_availability_with_capacity.guests, 
      api_check_availability_with_capacity.duration_minutes
    )
  LOOP
    v_available_slots := v_available_slots || json_build_object(
      'id', slot_record.id,
      'time', slot_record.slot_time,
      'capacity', slot_record.capacity
    );
    v_total_available_slots := v_total_available_slots + 1;
  END LOOP;

  -- Obtener información de capacidad de comensales
  FOR capacity_record IN
    SELECT * FROM get_diners_capacity_info(api_check_availability_with_capacity.date)
  LOOP
    v_capacity_info := v_capacity_info || json_build_object(
      'schedule_id', capacity_record.schedule_id,
      'opening_time', capacity_record.opening_time,
      'closing_time', capacity_record.closing_time,
      'max_diners', capacity_record.max_diners,
      'current_diners', capacity_record.current_diners,
      'available_diners', capacity_record.available_diners,
      'is_special_schedule', capacity_record.is_special_schedule,
      'occupancy_percentage', CASE 
        WHEN capacity_record.max_diners IS NOT NULL AND capacity_record.max_diners > 0
        THEN ROUND((capacity_record.current_diners::numeric / capacity_record.max_diners::numeric) * 100, 1)
        ELSE NULL
      END,
      'status', CASE
        WHEN capacity_record.max_diners IS NULL THEN 'unlimited'
        WHEN capacity_record.available_diners IS NULL THEN 'unlimited'
        WHEN capacity_record.available_diners <= 0 THEN 'full'
        WHEN capacity_record.available_diners < api_check_availability_with_capacity.guests THEN 'insufficient'
        WHEN (capacity_record.current_diners::numeric / capacity_record.max_diners::numeric) >= 0.9 THEN 'nearly_full'
        WHEN (capacity_record.current_diners::numeric / capacity_record.max_diners::numeric) >= 0.75 THEN 'busy'
        ELSE 'available'
      END
    );
    
    -- Marcar que hay límites de capacidad configurados
    IF capacity_record.max_diners IS NOT NULL THEN
      v_has_capacity_limits := true;
    END IF;
  END LOOP;

  -- Construir respuesta final
  v_result := json_build_object(
    'available', v_total_available_slots > 0,
    'date', api_check_availability_with_capacity.date,
    'guests', api_check_availability_with_capacity.guests,
    'duration_minutes', api_check_availability_with_capacity.duration_minutes,
    'available_slots', v_available_slots,
    'total_slots', v_total_available_slots,
    'capacity_info', v_capacity_info,
    'has_capacity_limits', v_has_capacity_limits,
    'summary', json_build_object(
      'can_accommodate', v_total_available_slots > 0,
      'table_availability', CASE 
        WHEN v_total_available_slots > 0 THEN 'available'
        ELSE 'unavailable'
      END,
      'capacity_status', CASE
        WHEN NOT v_has_capacity_limits THEN 'no_limits'
        WHEN array_length(v_capacity_info, 1) = 0 THEN 'no_schedule'
        WHEN EXISTS (
          SELECT 1 FROM json_array_elements(array_to_json(v_capacity_info)) AS elem
          WHERE elem->>'status' = 'full'
        ) THEN 'capacity_full'
        WHEN EXISTS (
          SELECT 1 FROM json_array_elements(array_to_json(v_capacity_info)) AS elem
          WHERE elem->>'status' = 'insufficient'
        ) THEN 'capacity_insufficient'
        WHEN EXISTS (
          SELECT 1 FROM json_array_elements(array_to_json(v_capacity_info)) AS elem
          WHERE elem->>'status' = 'nearly_full'
        ) THEN 'capacity_nearly_full'
        ELSE 'capacity_available'
      END,
      'recommendation', CASE
        WHEN v_total_available_slots = 0 THEN 'Try a different date or time'
        WHEN NOT v_has_capacity_limits THEN 'Reservation can be made'
        WHEN EXISTS (
          SELECT 1 FROM json_array_elements(array_to_json(v_capacity_info)) AS elem
          WHERE elem->>'status' IN ('full', 'insufficient')
        ) THEN 'Consider reducing party size or choosing different time'
        ELSE 'Reservation can be made'
      END
    ),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

-- Crear función simplificada para compatibilidad con la API existente
CREATE OR REPLACE FUNCTION api_check_availability(
  date date,
  guests integer,
  duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_full_result json;
  v_simplified_result json;
BEGIN
  -- Obtener resultado completo
  SELECT api_check_availability_with_capacity(
    api_check_availability.date, 
    api_check_availability.guests, 
    api_check_availability.duration_minutes
  ) INTO v_full_result;
  
  -- Crear versión simplificada para compatibilidad
  v_simplified_result := json_build_object(
    'available', v_full_result->>'available',
    'available_slots', v_full_result->'available_slots',
    'total_slots', v_full_result->>'total_slots',
    'date', api_check_availability.date,
    'guests', api_check_availability.guests,
    'duration_minutes', api_check_availability.duration_minutes
  );
  
  RETURN v_simplified_result;
END;
$$;

-- Comentarios para documentación
COMMENT ON FUNCTION api_check_availability_with_capacity IS 'Verifica disponibilidad considerando límites de mesas y comensales por turno';
COMMENT ON FUNCTION api_check_availability IS 'Versión simplificada de verificación de disponibilidad para compatibilidad';
