-- Función para verificar disponibilidad a través de un endpoint HTTP
CREATE OR REPLACE FUNCTION agent_availability(request JSONB)
RETURNS JSONB AS $$
DECLARE
  check_date DATE;
  guests INTEGER;
  available_slots JSONB;
BEGIN
  -- Extraer datos del request
  check_date := (request->>'date')::DATE;
  guests := (request->>'guests')::INTEGER;
  
  -- Validar datos requeridos
  IF check_date IS NULL OR guests IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required fields: date, guests'
    );
  END IF;
  
  -- Obtener slots disponibles usando la función existente
  SELECT COALESCE(jsonb_agg(slot), '[]'::JSONB) INTO available_slots
  FROM get_available_slots(check_date, guests) AS slot;
  
  -- Devolver resultado
  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'date', check_date,
      'guests', guests,
      'available_slots', available_slots
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error interno: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
