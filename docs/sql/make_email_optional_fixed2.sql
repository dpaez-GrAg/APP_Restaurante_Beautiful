-- ========================================
-- HACER EMAIL OPCIONAL EN CUSTOMERS
-- ========================================
-- Actualizar la tabla customers para que email sea opcional
-- y actualizar las funciones relacionadas

-- 1. Hacer el campo email opcional (permitir NULL)
ALTER TABLE public.customers 
ALTER COLUMN email DROP NOT NULL;

-- 2. Eliminar la restricción UNIQUE del email si existe
-- (para permitir múltiples registros sin email)
ALTER TABLE public.customers 
DROP CONSTRAINT IF EXISTS customers_email_key;

-- 3. Crear índice parcial para emails únicos (solo cuando no sea NULL)
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique_partial 
ON public.customers (email) 
WHERE email IS NOT NULL;

-- 4. Actualizar función admin_create_reservation para manejar email opcional
DROP FUNCTION IF EXISTS admin_create_reservation(text, text, date, time, integer, text, text, uuid[], integer);

-- Reorganizar los parámetros: primero los obligatorios, luego los opcionales con DEFAULT
CREATE OR REPLACE FUNCTION admin_create_reservation(
  -- Parámetros obligatorios primero
  p_customer_name text,
  p_date date,
  p_time time,
  p_guests integer,
  -- Parámetros opcionales con DEFAULT después
  p_customer_email text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_special_requests text DEFAULT NULL,
  p_table_ids uuid[] DEFAULT NULL,
  p_duration_minutes integer DEFAULT 90
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_reservation_result JSON;
  v_generated_email TEXT;
BEGIN
  -- Si no se proporciona email, generar uno único basado en el nombre y timestamp
  IF p_customer_email IS NULL OR p_customer_email = '' THEN
    v_generated_email := LOWER(REPLACE(p_customer_name, ' ', '')) || '_' || 
                        EXTRACT(EPOCH FROM NOW())::bigint || '@noemail.local';
  ELSE
    v_generated_email := p_customer_email;
  END IF;
  
  -- Crear o actualizar customer
  INSERT INTO public.customers (name, email, phone)
  VALUES (p_customer_name, v_generated_email, p_customer_phone)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    updated_at = now()
  RETURNING id INTO v_customer_id;
  
  -- Crear reserva con mesas específicas o asignación automática
  IF p_table_ids IS NOT NULL THEN
    SELECT public.create_reservation_with_specific_tables(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_table_ids, p_duration_minutes
    ) INTO v_reservation_result;
  ELSE
    SELECT public.create_reservation_with_assignment(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
    ) INTO v_reservation_result;
  END IF;
  
  -- Añadir información del customer al resultado
  IF (v_reservation_result->>'success')::boolean = true THEN
    v_reservation_result := v_reservation_result || json_build_object(
      'customer_info', json_build_object(
        'id', v_customer_id,
        'name', p_customer_name,
        'email', CASE WHEN p_customer_email IS NULL OR p_customer_email = '' THEN NULL ELSE p_customer_email END,
        'phone', p_customer_phone
      )
    );
  END IF;
  
  RETURN v_reservation_result;
END;
$$;

-- 5. Crear función helper para crear customers sin email obligatorio
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
BEGIN
  -- Si no se proporciona email, generar uno único
  IF p_email IS NULL OR p_email = '' THEN
    v_generated_email := LOWER(REPLACE(p_name, ' ', '')) || '_' || 
                        EXTRACT(EPOCH FROM NOW())::bigint || '@noemail.local';
  ELSE
    v_generated_email := p_email;
  END IF;
  
  -- Crear customer
  INSERT INTO public.customers (name, email, phone)
  VALUES (p_name, v_generated_email, p_phone)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    updated_at = now()
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;

-- 6. Verificar los cambios
SELECT 'VERIFICACIÓN' as step,
       column_name,
       is_nullable,
       column_default
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('name', 'email', 'phone')
ORDER BY column_name;

COMMENT ON FUNCTION admin_create_reservation IS 'Función administrativa para crear reservas con email opcional';
COMMENT ON FUNCTION create_customer_optional_email IS 'Crear customer con email opcional, genera email automático si no se proporciona';
