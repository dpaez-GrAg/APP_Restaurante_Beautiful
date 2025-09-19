-- ========================================
-- CORREGIR FUNCIÓN create_customer_optional_email
-- ========================================
-- La función está intentando usar ON CONFLICT (email) pero eliminamos la restricción UNIQUE

-- Eliminar la función existente
DROP FUNCTION IF EXISTS create_customer_optional_email(text, text, text);

-- Recrear la función sin ON CONFLICT
CREATE OR REPLACE FUNCTION create_customer_optional_email(
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_generated_email TEXT;
  v_existing_customer UUID;
BEGIN
  -- Si no se proporciona email, generar uno único
  IF p_email IS NULL OR p_email = '' THEN
    v_generated_email := LOWER(REPLACE(p_name, ' ', '')) || '_' || 
                        EXTRACT(EPOCH FROM NOW())::bigint || '@noemail.local';
  ELSE
    v_generated_email := p_email;
  END IF;
  
  -- Buscar si ya existe un customer con el mismo teléfono (más confiable que email)
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT id INTO v_existing_customer
    FROM public.customers 
    WHERE phone = p_phone
    LIMIT 1;
    
    -- Si existe, actualizar sus datos y devolver el ID
    IF v_existing_customer IS NOT NULL THEN
      UPDATE public.customers 
      SET name = p_name,
          email = v_generated_email,
          updated_at = now()
      WHERE id = v_existing_customer;
      
      RETURN v_existing_customer;
    END IF;
  END IF;
  
  -- Si no existe, crear nuevo customer
  INSERT INTO public.customers (name, email, phone)
  VALUES (p_name, v_generated_email, p_phone)
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;

-- Verificar que la función se creó correctamente
SELECT 'FUNCIÓN CORREGIDA' as status,
       proname,
       pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'create_customer_optional_email';

-- Probar la función
SELECT 'TEST FUNCIÓN CORREGIDA' as test_type,
       create_customer_optional_email('Diego Test', '777666555', null) as customer_id;

-- Verificar que el customer se creó
SELECT 'CUSTOMER CREADO' as test_type,
       id, name, email, phone
FROM public.customers 
WHERE name = 'Diego Test'
ORDER BY created_at DESC
LIMIT 1;

-- Limpiar el customer de prueba
DELETE FROM public.customers WHERE name = 'Diego Test';

COMMENT ON FUNCTION create_customer_optional_email IS 'Crear customer con email opcional, busca por teléfono para evitar duplicados';
