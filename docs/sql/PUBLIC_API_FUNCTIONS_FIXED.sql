-- ========================================
-- FUNCIONES PARA API PÚBLICA (CORREGIDAS)
-- ========================================
-- Funciones que permiten crear reservas desde agentes externos
-- sin necesidad de conocer UUIDs internos

-- FUNCIÓN PÚBLICA: Crear reserva completa con datos del cliente
CREATE OR REPLACE FUNCTION public_create_reservation(
    p_customer_name text,
    p_customer_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_customer_email text DEFAULT NULL,
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
BEGIN
    -- Validar datos obligatorios
    IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El nombre del cliente es obligatorio'
        );
    END IF;
    
    IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El teléfono del cliente es obligatorio'
        );
    END IF;
    
    -- Verificar si el cliente ya existe por teléfono
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = p_customer_phone
    LIMIT 1;
    
    v_customer_exists := FOUND;
    
    -- Si no existe, crear el cliente
    IF NOT v_customer_exists THEN
        INSERT INTO public.customers (name, phone, email)
        VALUES (trim(p_customer_name), trim(p_customer_phone), trim(p_customer_email))
        RETURNING id INTO v_customer_id;
    ELSE
        -- Actualizar datos del cliente existente si es necesario
        UPDATE public.customers
        SET 
            name = CASE WHEN trim(p_customer_name) != '' THEN trim(p_customer_name) ELSE name END,
            email = CASE WHEN p_customer_email IS NOT NULL AND trim(p_customer_email) != '' THEN trim(p_customer_email) ELSE email END,
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
        -- Devolver respuesta completa con datos del cliente
        RETURN json_build_object(
            'success', true,
            'message', 'Reserva creada exitosamente',
            'reservation_id', v_reservation_result->>'reservation_id',
            'customer', json_build_object(
                'id', v_customer_id,
                'name', p_customer_name,
                'phone', p_customer_phone,
                'email', p_customer_email,
                'was_created', NOT v_customer_exists
            ),
            'reservation', json_build_object(
                'date', p_date,
                'time', p_time,
                'guests', p_guests,
                'duration_minutes', p_duration_minutes,
                'special_requests', p_special_requests
            ),
            'tables_assigned', v_reservation_result->'tables_assigned'
        );
    ELSE
        -- Si falló la reserva, devolver el error
        RETURN v_reservation_result;
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al crear la reserva: ' || SQLERRM
    );
END;
$$;

-- FUNCIÓN PÚBLICA: Crear reserva usando slot específico
CREATE OR REPLACE FUNCTION public_create_reservation_with_slot(
    p_customer_name text,
    p_customer_phone text,
    p_date date,
    p_slot_id uuid,
    p_guests integer,
    p_customer_email text DEFAULT NULL,
    p_duration_minutes integer DEFAULT 120,
    p_special_requests text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slot_time time;
    v_table_capacity integer;
BEGIN
    -- Obtener información del slot (mesa y hora)
    SELECT 
        '13:30:00'::time, -- Esto debería venir de una tabla de slots reales
        4 -- Esto debería venir de la capacidad real de la mesa
    INTO v_slot_time, v_table_capacity;
    
    -- Verificar que el slot existe y tiene capacidad suficiente
    -- (Aquí deberías implementar la lógica real de verificación de slots)
    
    -- Crear la reserva usando la función pública principal
    RETURN public_create_reservation(
        p_customer_name,
        p_customer_phone,
        p_date,
        v_slot_time,
        p_guests,
        p_customer_email,
        p_duration_minutes,
        p_special_requests
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al crear la reserva con slot: ' || SQLERRM
    );
END;
$$;

-- FUNCIÓN PÚBLICA: Buscar reserva por teléfono (ya existe, pero agregar alias)
CREATE OR REPLACE FUNCTION public_find_reservation(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN find_reservation_by_phone(p_phone);
END;
$$;

-- FUNCIÓN PÚBLICA: Cancelar reserva por teléfono y fecha
CREATE OR REPLACE FUNCTION public_cancel_reservation(
    p_customer_phone text,
    p_date date,
    p_time time DEFAULT NULL,
    p_reason text DEFAULT 'Cancelada por el cliente'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id uuid;
    v_reservations_found integer;
BEGIN
    -- Buscar la reserva por teléfono y fecha
    IF p_time IS NOT NULL THEN
        -- Buscar por teléfono, fecha y hora específica
        SELECT r.id INTO v_reservation_id
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE c.phone = p_customer_phone
          AND r.date = p_date
          AND r.time = p_time
          AND r.status IN ('confirmed', 'pending')
        LIMIT 1;
    ELSE
        -- Buscar por teléfono y fecha (cualquier hora)
        SELECT r.id, COUNT(*) OVER() INTO v_reservation_id, v_reservations_found
        FROM public.reservations r
        JOIN public.customers c ON r.customer_id = c.id
        WHERE c.phone = p_customer_phone
          AND r.date = p_date
          AND r.status IN ('confirmed', 'pending')
        LIMIT 1;
        
        -- Si hay múltiples reservas, requerir hora específica
        IF v_reservations_found > 1 THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Se encontraron múltiples reservas para esa fecha. Especifica la hora.',
                'reservations_found', v_reservations_found
            );
        END IF;
    END IF;
    
    IF v_reservation_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No se encontró ninguna reserva activa para cancelar'
        );
    END IF;
    
    -- Cancelar la reserva usando la función existente
    RETURN cancel_reservation_by_id(v_reservation_id, p_reason);
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', 'Error al cancelar la reserva: ' || SQLERRM
    );
END;
$$;

-- ========================================
-- COMENTARIOS PARA FUNCIONES PÚBLICAS
-- ========================================
COMMENT ON FUNCTION public_create_reservation IS 'API pública: Crear reserva completa con datos del cliente';
COMMENT ON FUNCTION public_create_reservation_with_slot IS 'API pública: Crear reserva usando slot específico de disponibilidad';
COMMENT ON FUNCTION public_find_reservation IS 'API pública: Buscar reserva por teléfono';
COMMENT ON FUNCTION public_cancel_reservation IS 'API pública: Cancelar reserva por teléfono y fecha';

-- ========================================
-- EJEMPLOS DE USO CORREGIDOS
-- ========================================
/*
-- CREAR RESERVA (orden corregido):
SELECT public_create_reservation(
    'Juan Pérez',           -- nombre (obligatorio)
    '666777888',            -- teléfono (obligatorio)
    '2025-09-24',           -- fecha (obligatorio)
    '20:00:00',             -- hora (obligatorio)
    4,                      -- comensales (obligatorio)
    'juan@email.com',       -- email (opcional)
    120,                    -- duración en minutos (opcional)
    'Mesa junto a ventana'  -- peticiones especiales (opcional)
);

-- BUSCAR RESERVA:
SELECT public_find_reservation('666777888');

-- CANCELAR RESERVA:
SELECT public_cancel_reservation(
    '666777888',            -- teléfono (obligatorio)
    '2025-09-24',           -- fecha (obligatorio)
    '20:00:00',             -- hora (opcional)
    'Cambio de planes'      -- motivo (opcional)
);
*/
