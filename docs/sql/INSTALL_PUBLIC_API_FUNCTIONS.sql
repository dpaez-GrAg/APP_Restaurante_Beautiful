-- ========================================
-- INSTALACIÓN: FUNCIONES DE API PÚBLICA
-- ========================================
-- Fecha: 2025-10-27
-- Funciones para agentes externos sin autenticación
-- ========================================

-- ========================================
-- FUNCIÓN 1: public_create_reservation
-- ========================================
-- Crear reserva completa con gestión automática de clientes

DROP FUNCTION IF EXISTS public_create_reservation(text, text, date, time, integer, text, integer, text);

CREATE OR REPLACE FUNCTION public_create_reservation(
    p_name text,
    p_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_email text DEFAULT NULL,
    p_duration_minutes integer DEFAULT 90,
    p_special_requests text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_reservation_result json;
    v_customer_exists boolean;
    v_reservation_id uuid;
    v_tables_info json;
BEGIN
    -- Validar datos obligatorios
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El nombre del cliente es obligatorio'
        );
    END IF;
    
    IF p_phone IS NULL OR trim(p_phone) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El teléfono del cliente es obligatorio'
        );
    END IF;
    
    -- Verificar si el cliente ya existe por teléfono
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = p_phone
    LIMIT 1;
    
    v_customer_exists := FOUND;
    
    -- Si no existe, crear el cliente
    IF NOT v_customer_exists THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (trim(p_name), trim(p_phone), trim(p_email))
        RETURNING id INTO v_customer_id;
    ELSE
        -- Actualizar datos del cliente existente si es necesario
        UPDATE public.customers
        SET 
            name = CASE WHEN trim(p_name) != '' THEN trim(p_name) ELSE name END,
            email = CASE WHEN p_email IS NOT NULL AND trim(p_email) != '' THEN trim(p_email) ELSE email END,
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;
    
    -- Crear la reserva usando la función existente
    SELECT create_reservation_with_assignment(
        v_customer_id,
        p_date,
        p_time,
        p_guests,
        p_special_requests,
        p_duration_minutes
    ) INTO v_reservation_result;
    
    -- Verificar si la reserva se creó exitosamente
    IF (v_reservation_result->>'success')::boolean = true THEN
        v_reservation_id := (v_reservation_result->>'reservation_id')::uuid;
        
        -- Obtener información simplificada de las mesas asignadas
        SELECT json_agg(
            json_build_object(
                'name', t.name,
                'zone', COALESCE(z.name, 'Sin zona')
            )
        )
        INTO v_tables_info
        FROM public.reservation_table_assignments rta
        JOIN public.tables t ON rta.table_id = t.id
        LEFT JOIN public.zones z ON t.zone_id = z.id
        WHERE rta.reservation_id = v_reservation_id;
        
        -- Devolver respuesta simplificada
        RETURN json_build_object(
            'success', true,
            'message', 'Reserva creada exitosamente',
            'customer', json_build_object(
                'name', p_name,
                'phone', p_phone
            ),
            'reservation', json_build_object(
                'date', p_date,
                'time', p_time,
                'guests', p_guests,
                'duration_minutes', p_duration_minutes,
                'special_requests', p_special_requests
            ),
            'tables', v_tables_info
        );
    ELSE
        -- La reserva falló, devolver el error
        RETURN v_reservation_result;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al crear la reserva: ' || SQLERRM
        );
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public_create_reservation(text, text, date, time, integer, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public_create_reservation(text, text, date, time, integer, text, integer, text) TO authenticated;

COMMENT ON FUNCTION public_create_reservation IS 'API pública: Crea una reserva con gestión automática de clientes (respuesta simplificada)';

-- ========================================
-- FUNCIÓN 2: public_find_reservation
-- ========================================
-- Buscar reservas por teléfono

DROP FUNCTION IF EXISTS public_find_reservation(text);

CREATE OR REPLACE FUNCTION public_find_reservation(
    p_phone text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservations json;
    v_normalized_phone text;
BEGIN
    -- Normalizar teléfono (quitar espacios, guiones, etc.)
    v_normalized_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
    
    -- Buscar reservas activas del cliente
    WITH reservations_data AS (
        SELECT 
            r.id,
            r.date,
            r.time,
            r.guests,
            r.status,
            r.special_requests,
            c.name as customer_name,
            c.phone as customer_phone
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE regexp_replace(c.phone, '[^0-9+]', '', 'g') = v_normalized_phone
          AND r.status IN ('confirmed', 'arrived')
          AND r.end_at > NOW()
        ORDER BY r.date, r.time
    )
    SELECT json_agg(
        json_build_object(
            'reservation_id', rd.id,
            'date', rd.date,
            'time', rd.time,
            'guests', rd.guests,
            'status', rd.status,
            'special_requests', rd.special_requests,
            'customer_name', rd.customer_name,
            'customer_phone', rd.customer_phone,
            'tables', (
                SELECT json_agg(
                    json_build_object(
                        'name', t.name,
                        'capacity', t.capacity,
                        'zone', COALESCE(z.name, 'Sin zona')
                    )
                )
                FROM public.reservation_table_assignments rta
                JOIN public.tables t ON rta.table_id = t.id
                LEFT JOIN public.zones z ON t.zone_id = z.id
                WHERE rta.reservation_id = rd.id
            )
        )
    )
    INTO v_reservations
    FROM reservations_data rd;
    
    IF v_reservations IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'message', 'No se encontraron reservas activas para este teléfono',
            'reservations', '[]'::json
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reservas encontradas',
        'reservations', v_reservations
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al buscar reservas: ' || SQLERRM
        );
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public_find_reservation(text) TO anon;
GRANT EXECUTE ON FUNCTION public_find_reservation(text) TO authenticated;

COMMENT ON FUNCTION public_find_reservation IS 'API pública: Busca reservas activas por número de teléfono';

-- ========================================
-- FUNCIÓN 3: public_cancel_reservation
-- ========================================
-- Cancelar reserva por teléfono, fecha y hora

DROP FUNCTION IF EXISTS public_cancel_reservation(text, date, time, text);

CREATE OR REPLACE FUNCTION public_cancel_reservation(
    p_phone text,
    p_date date,
    p_time time,
    p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id uuid;
    v_normalized_phone text;
    v_customer_name text;
BEGIN
    -- Normalizar teléfono
    v_normalized_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
    
    -- Buscar la reserva
    SELECT r.id, c.name
    INTO v_reservation_id, v_customer_name
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    WHERE regexp_replace(c.phone, '[^0-9+]', '', 'g') = v_normalized_phone
      AND r.date = p_date
      AND r.time = p_time
      AND r.status IN ('confirmed', 'arrived')
    LIMIT 1;
    
    IF v_reservation_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se encontró una reserva activa con esos datos'
        );
    END IF;
    
    -- Cancelar la reserva
    UPDATE public.reservations
    SET 
        status = 'cancelled',
        cancellation_reason = COALESCE(p_reason, 'Cancelada por el cliente'),
        updated_at = NOW()
    WHERE id = v_reservation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Reserva cancelada exitosamente',
        'reservation_id', v_reservation_id,
        'customer_name', v_customer_name,
        'date', p_date,
        'time', p_time
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error al cancelar la reserva: ' || SQLERRM
        );
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public_cancel_reservation(text, date, time, text) TO anon;
GRANT EXECUTE ON FUNCTION public_cancel_reservation(text, date, time, text) TO authenticated;

COMMENT ON FUNCTION public_cancel_reservation IS 'API pública: Cancela una reserva por teléfono, fecha y hora';

-- ========================================
-- VERIFICACIÓN
-- ========================================

SELECT 'Funciones de API pública instaladas correctamente:' as status;
SELECT '- public_create_reservation' as funcion;
SELECT '- public_find_reservation' as funcion;
SELECT '- public_cancel_reservation' as funcion;
SELECT '- api_check_availability (ya existía)' as funcion;
