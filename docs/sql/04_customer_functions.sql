-- ========================================
-- FUNCIONES DE GESTIÓN DE CLIENTES
-- ========================================
-- Este archivo contiene todas las funciones relacionadas con:
-- - Gestión de clientes
-- - Clasificación de clientes (VIP, NEUTRO, ALERTA, RED FLAG)
-- - Email opcional en customers


-- Funciones de: fix_create_customer_function.sql
-- ========================================
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

-- ========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ========================================
COMMENT ON FUNCTION create_customer_optional_email IS 'Crea o actualiza un cliente con email opcional';

-- NOTA: Para probar la función, usar después de ejecutar este script:
-- SELECT create_customer_optional_email('Diego Test', '777666555', null) as customer_id;
-- 
-- Verificar que el customer se creó:
-- SELECT id, name, email, phone FROM public.customers WHERE name = 'Diego Test';

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Funciones de: add_customer_classification_system.sql
-- ========================================
-- ========================================
-- SISTEMA DE CLASIFICACIÓN DE CLIENTES
-- ========================================
-- Añade clasificación de clientes con historial de cambios

-- 1. El enum customer_classification ya existe en 01_database_structure.sql
-- No necesitamos crearlo de nuevo

-- 2. Añadir campos a la tabla customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS classification customer_classification DEFAULT 'NEUTRO',
ADD COLUMN IF NOT EXISTS classification_notes TEXT,
ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS classification_updated_by UUID REFERENCES auth.users(id);

-- 3. NOTA: La tabla customer_classification_history fue eliminada
-- El historial de clasificación no se mantiene en base de datos
-- Solo se guarda la clasificación actual en la tabla customers

-- 4. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_customers_classification ON customers(classification);
CREATE INDEX IF NOT EXISTS idx_customers_classification_updated_at ON customers(classification_updated_at);

-- 5. Crear función para actualizar clasificación (SIN historial)
CREATE OR REPLACE FUNCTION update_customer_classification(
    p_customer_id uuid,
    p_new_classification customer_classification,
    p_notes text DEFAULT NULL,
    p_changed_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_classification customer_classification;
    v_customer_name text;
BEGIN
    -- Obtener clasificación actual y nombre
    SELECT classification, name 
    INTO v_old_classification, v_customer_name
    FROM customers
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Cliente no encontrado'
        );
    END IF;

    -- Si no hay cambio, retornar sin hacer nada
    IF v_old_classification = p_new_classification THEN
        RETURN json_build_object(
            'success', false,
            'message', 'La clasificación es la misma',
            'old_classification', v_old_classification,
            'new_classification', p_new_classification
        );
    END IF;

    -- Actualizar clasificación directamente (sin tabla de historial)
    UPDATE customers
    SET 
        classification = p_new_classification,
        classification_notes = p_notes,
        classification_updated_at = NOW(),
        classification_updated_by = p_changed_by,
        updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Clasificación actualizada exitosamente',
        'customer_id', p_customer_id,
        'customer_name', v_customer_name,
        'old_classification', v_old_classification,
        'new_classification', p_new_classification,
        'notes', p_notes
    );
END;
$$;

-- 6. NOTA: La función get_customer_classification_history fue eliminada
-- porque la tabla customer_classification_history no existe

-- 7. Crear función para obtener clientes con información de reservas
CREATE OR REPLACE FUNCTION get_customers_with_stats(
    p_search TEXT DEFAULT NULL,
    p_classification customer_classification DEFAULT NULL,
    p_order_by TEXT DEFAULT 'name',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    email TEXT,
    classification customer_classification,
    classification_notes TEXT,
    classification_updated_at TIMESTAMP WITH TIME ZONE,
    total_reservations BIGINT,
    last_reservation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.classification,
        c.classification_notes,
        c.classification_updated_at,
        COALESCE(r.total_reservations, 0) as total_reservations,
        r.last_reservation_date,
        c.created_at
    FROM customers c
    LEFT JOIN (
        SELECT 
            customer_id,
            COUNT(*) as total_reservations,
            MAX(date) as last_reservation_date
        FROM reservations 
        WHERE status IN ('confirmed', 'completed')
        GROUP BY customer_id
    ) r ON c.id = r.customer_id
    WHERE 
        (p_search IS NULL OR 
         c.name ILIKE '%' || p_search || '%' OR 
         c.phone ILIKE '%' || p_search || '%')
        AND (p_classification IS NULL OR c.classification = p_classification)
    ORDER BY 
        CASE 
            WHEN p_order_by = 'name' THEN c.name
            WHEN p_order_by = 'classification' THEN c.classification::text
            WHEN p_order_by = 'last_reservation' THEN r.last_reservation_date::text
            ELSE c.name
        END
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Verificar instalación
SELECT 'CLASIFICACIÓN DE CLIENTES INSTALADA' as status,
       COUNT(*) as total_customers,
       COUNT(CASE WHEN classification = 'VIP' THEN 1 END) as vip_customers,
       COUNT(CASE WHEN classification = 'NEUTRO' THEN 1 END) as neutro_customers,
       COUNT(CASE WHEN classification = 'ALERTA' THEN 1 END) as alerta_customers,
       COUNT(CASE WHEN classification = 'RED_FLAG' THEN 1 END) as red_flag_customers
FROM customers;

-- ========================================
-- FUNCIONES CRÍTICAS AGREGADAS DESDE FIXES
-- ========================================

-- FUNCIÓN CRÍTICA: find_reservation_by_phone (NUEVA)
CREATE OR REPLACE FUNCTION find_reservation_by_phone_simple(
    p_phone text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    -- ✅ USAR SUBQUERY PARA EVITAR PROBLEMAS DE GROUP BY
    WITH reservations_data AS (
        SELECT 
            r.id,
            c.name as customer_name,
            c.phone as customer_phone,
            r.date,
            r.time,
            r.guests,
            r.status,
            r.special_requests
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE c.phone = p_phone
          AND r.status IN ('confirmed', 'pending', 'arrived')
          AND r.date >= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY r.date DESC, r.time DESC
    )
    SELECT CASE 
        WHEN COUNT(*) = 0 THEN 
            json_build_object(
                'success', false,
                'message', 'No se encontraron reservas para este teléfono',
                'reservations', json_build_array()
            )
        ELSE 
            json_build_object(
                'success', true,
                'message', 'Reservas encontradas',
                'reservations', json_agg(
                    json_build_object(
                        'id', id,
                        'customer_name', customer_name,
                        'customer_phone', customer_phone,
                        'date', date,
                        'time', time,
                        'guests', guests,
                        'status', status,
                        'special_requests', special_requests
                    )
                )
            )
    END INTO v_result
    FROM reservations_data;
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al buscar reservas: ' || SQLERRM,
        'reservations', json_build_array()
    );
END;
$$;

-- Función principal que usa la versión simple
CREATE OR REPLACE FUNCTION find_reservation_by_phone(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN find_reservation_by_phone_simple(p_phone);
END;
$$;

-- Función alternativa para compatibilidad
CREATE OR REPLACE FUNCTION search_reservations_by_phone(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN find_reservation_by_phone(p_phone);
END;
$$;

-- ========================================
-- COMENTARIOS PARA FUNCIONES CRÍTICAS
-- ========================================
COMMENT ON FUNCTION find_reservation_by_phone_simple IS 'Busca reservas por teléfono con CTE para evitar GROUP BY';
COMMENT ON FUNCTION find_reservation_by_phone IS 'Función principal de búsqueda de reservas por teléfono';
COMMENT ON FUNCTION search_reservations_by_phone IS 'Función alternativa de búsqueda para compatibilidad';

-- ========================================
-- FINALIZACIÓN ACTUALIZADA
-- ========================================
SELECT 'FUNCIONES DE CLIENTES ACTUALIZADAS' as status,
       'Funciones de búsqueda críticas agregadas desde fixes' as mensaje;
