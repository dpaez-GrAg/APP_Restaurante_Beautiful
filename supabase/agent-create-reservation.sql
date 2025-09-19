-- Función para crear reservas a través de un endpoint HTTP
CREATE OR REPLACE FUNCTION agent_create_reservation(request JSONB)
RETURNS JSONB AS $$
DECLARE
  customer_name TEXT;
  customer_email TEXT;
  customer_phone TEXT;
  reservation_date DATE;
  reservation_time TIME;
  guests INTEGER;
  special_requests TEXT;
  duration_minutes INTEGER;
  customer_id UUID;
  existing_customer RECORD;
  new_customer RECORD;
  result JSONB;
  reservation_id UUID;
BEGIN
  -- Extraer datos del request
  customer_name := request->>'customer_name';
  customer_email := request->>'customer_email';
  customer_phone := request->>'customer_phone';
  reservation_date := (request->>'date')::DATE;
  reservation_time := (request->>'time')::TIME;
  guests := (request->>'guests')::INTEGER;
  special_requests := request->>'special_requests';
  duration_minutes := COALESCE((request->>'duration_minutes')::INTEGER, 90);
  
  -- Validar datos requeridos
  IF customer_name IS NULL OR customer_email IS NULL OR reservation_date IS NULL OR reservation_time IS NULL OR guests IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required fields: customer_name, customer_email, date, time, guests'
    );
  END IF;
  
  -- Buscar cliente existente o crear uno nuevo
  SELECT id INTO existing_customer FROM customers WHERE email = customer_email LIMIT 1;
  
  IF existing_customer.id IS NOT NULL THEN
    customer_id := existing_customer.id;
  ELSE
    INSERT INTO customers (name, email, phone)
    VALUES (customer_name, customer_email, customer_phone)
    RETURNING id INTO new_customer;
    
    customer_id := new_customer.id;
  END IF;
  
  -- Crear reserva usando la función existente create_reservation_with_assignment
  SELECT * FROM create_reservation_with_assignment(
    customer_id,
    reservation_date,
    reservation_time,
    guests,
    special_requests,
    duration_minutes
  ) INTO result;
  
  -- Verificar resultado
  IF result->>'success' = 'true' THEN
    reservation_id := (result->>'reservation_id')::UUID;
    
    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'reservation_id', reservation_id,
        'customer_id', customer_id,
        'date', reservation_date,
        'time', reservation_time,
        'guests', guests,
        'status', 'confirmed'
      )
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(result->>'error', 'No se pudo crear la reserva. Por favor, inténtalo de nuevo.')
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Error interno: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
