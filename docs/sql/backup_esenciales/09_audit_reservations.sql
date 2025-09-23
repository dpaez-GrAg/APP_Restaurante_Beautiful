-- =====================================================
-- AUDITORÍA PARA FUNCIONES DE RESERVAS
-- =====================================================
-- Modifica las funciones existentes para agregar logging de auditoría

-- 1. Función mejorada: create_reservation_with_assignment CON AUDITORÍA
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
    p_customer_id uuid,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_start_at TIMESTAMP WITH TIME ZONE;
    v_end_at TIMESTAMP WITH TIME ZONE;
    v_assigned_tables UUID[];
    v_table_record RECORD;
    v_needed_capacity INTEGER;
    v_current_capacity INTEGER;
    v_day_of_week INTEGER;
    v_schedule_exists BOOLEAN;
    v_special_closed BOOLEAN;
    v_special_schedule RECORD;
    v_combination RECORD;
    v_diners_check json;
    v_customer_name TEXT;
    v_result json;
BEGIN
    -- Verificar que el customer_id no sea NULL
    IF p_customer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Customer ID cannot be null');
    END IF;

    -- Obtener nombre del cliente para auditoría
    SELECT name INTO v_customer_name
    FROM customers 
    WHERE id = p_customer_id;
    
    v_customer_name := COALESCE(v_customer_name, 'Cliente desconocido');

    -- Normalize to Europe/Madrid
    v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

    v_day_of_week := EXTRACT(DOW FROM p_date);

    -- Check if restaurant is closed
    SELECT COUNT(*) > 0 INTO v_special_closed
    FROM public.special_closed_days 
    WHERE (
        (NOT is_range AND date = p_date) OR
        (is_range AND p_date BETWEEN range_start AND range_end)
    );
    IF v_special_closed THEN
        RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
    END IF;

    -- Check opening hours
    SELECT opening_time, closing_time INTO v_special_schedule
    FROM public.special_schedule_days 
    WHERE date = p_date AND is_active = true
    LIMIT 1;

    IF FOUND THEN
        IF p_time < v_special_schedule.opening_time OR p_time >= v_special_schedule.closing_time THEN
            RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
        END IF;
    ELSE
        SELECT COUNT(*) > 0 INTO v_schedule_exists
        FROM public.restaurant_schedules 
        WHERE day_of_week = v_day_of_week AND is_active = true
          AND p_time >= opening_time AND p_time < closing_time;
        IF NOT v_schedule_exists THEN
            RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
        END IF;
    END IF;

    -- Verificar límites de comensales por turno
    SELECT check_diners_limit(p_date, p_time, p_guests) INTO v_diners_check;
    IF (v_diners_check->>'success')::boolean = false THEN
        RETURN v_diners_check;
    END IF;

    v_needed_capacity := p_guests;
    v_assigned_tables := ARRAY[]::UUID[];
    v_current_capacity := 0;

    -- PASO 1: Buscar una mesa individual con capacidad suficiente
    SELECT t.id
    INTO v_table_record
    FROM public.tables t
    WHERE t.is_active = true
      AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
      AND is_table_available(t.id, p_date, v_start_at, v_end_at)
    ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC
    LIMIT 1;

    IF FOUND THEN
        -- Encontramos una mesa individual que funciona
        v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
        SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
        FROM public.tables t WHERE t.id = v_table_record.id;
    ELSE
        -- PASO 2: No hay mesa individual, buscar combinaciones válidas
        FOR v_combination IN
            SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
            FROM public.table_combinations tc
            WHERE tc.is_active = true
              AND p_guests >= COALESCE(tc.min_capacity, 1)
              AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
              AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
            ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC
        LOOP
            -- Check if all tables in this combination are available
            IF (
                SELECT bool_and(is_table_available(table_id, p_date, v_start_at, v_end_at))
                FROM unnest(v_combination.table_ids) AS table_id
            ) THEN
                -- This combination is available
                v_assigned_tables := v_combination.table_ids;
                v_current_capacity := v_combination.effective_capacity;
                EXIT;
            END IF;
        END LOOP;

        -- Si no encontramos combinación válida, la reserva no se puede realizar
        IF array_length(v_assigned_tables, 1) = 0 OR v_assigned_tables IS NULL THEN
            RETURN json_build_object('success', false, 'error', 'No hay mesas disponibles para esta capacidad');
        END IF;
    END IF;

    -- Verificar que tenemos capacidad suficiente
    IF v_current_capacity < v_needed_capacity THEN
        RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
    END IF;

    INSERT INTO public.reservations (
        customer_id, date, time, guests, special_requests, 
        status, duration_minutes, start_at, end_at, created_by
    )
    VALUES (
        p_customer_id, p_date, p_time, p_guests, p_special_requests, 
        'confirmed', p_duration_minutes, v_start_at, v_end_at, auth.uid()
    )
    RETURNING id INTO v_reservation_id;

    FOR i IN 1..array_length(v_assigned_tables, 1) LOOP
        INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
        VALUES (v_reservation_id, v_assigned_tables[i]);
    END LOOP;

    -- AUDITORÍA: Registrar creación de reserva
    PERFORM log_audit_action(
        'reservation_created',
        'reservations',
        v_reservation_id,
        v_customer_name,
        NULL, -- user_id es NULL para clientes web
        jsonb_build_object(
            'reservation_id', v_reservation_id,
            'customer_name', v_customer_name,
            'date', p_date,
            'time', p_time,
            'guests', p_guests,
            'assigned_tables', v_assigned_tables,
            'capacity_used', v_current_capacity,
            'special_requests', p_special_requests,
            'duration_minutes', p_duration_minutes
        )
    );

    v_result := json_build_object(
        'success', true, 
        'reservation_id', v_reservation_id,
        'assigned_tables', v_assigned_tables,
        'capacity_used', v_current_capacity,
        'guests_requested', p_guests
    );

    RETURN v_result;
END;
$$;

-- 2. Función para cancelar reserva CON AUDITORÍA
CREATE OR REPLACE FUNCTION cancel_reservation_with_audit(
    p_reservation_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by customer'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_customer_name TEXT;
    v_user_name TEXT;
    v_current_user_id UUID;
    v_user_profile RECORD;
BEGIN
    -- Obtener información de la reserva
    SELECT r.*, c.name as customer_name 
    INTO v_reservation
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    WHERE r.id = p_reservation_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Reservation not found');
    END IF;

    IF v_reservation.status = 'cancelled' THEN
        RETURN json_build_object('success', false, 'error', 'Reservation already cancelled');
    END IF;

    v_customer_name := v_reservation.customer_name;
    
    -- Determinar quién cancela la reserva
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NOT NULL THEN
        -- Cancelación por admin/usuario
        SELECT full_name, email INTO v_user_profile 
        FROM profiles 
        WHERE id = v_current_user_id;
        
        v_user_name := COALESCE(v_user_profile.full_name, v_user_profile.email, 'Usuario autenticado');
    ELSE
        -- Cancelación por cliente web
        v_user_name := v_customer_name;
    END IF;

    -- Actualizar estado de la reserva
    UPDATE reservations 
    SET status = 'cancelled', 
        updated_at = NOW()
    WHERE id = p_reservation_id;

    -- AUDITORÍA: Registrar cancelación de reserva
    PERFORM log_audit_action(
        'reservation_cancelled',
        'reservations',
        p_reservation_id,
        v_user_name,
        v_current_user_id,
        jsonb_build_object(
            'reservation_id', p_reservation_id,
            'customer_name', v_customer_name,
            'date', v_reservation.date,
            'time', v_reservation.time,
            'guests', v_reservation.guests,
            'reason', p_reason,
            'cancelled_by_type', CASE WHEN v_current_user_id IS NOT NULL THEN 'admin' ELSE 'customer' END
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Reservation cancelled successfully',
        'reservation_id', p_reservation_id
    );
END;
$$;

-- 3. Función para modificar reserva CON AUDITORÍA
CREATE OR REPLACE FUNCTION modify_reservation_with_audit(
    p_reservation_id UUID,
    p_new_date DATE DEFAULT NULL,
    p_new_time TIME DEFAULT NULL,
    p_new_guests INTEGER DEFAULT NULL,
    p_new_special_requests TEXT DEFAULT NULL,
    p_modification_reason TEXT DEFAULT 'Modified by admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation RECORD;
    v_customer_name TEXT;
    v_user_name TEXT;
    v_current_user_id UUID;
    v_user_profile RECORD;
    v_changes JSONB := '{}'::jsonb;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- Obtener información de la reserva actual
    SELECT r.*, c.name as customer_name 
    INTO v_reservation
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    WHERE r.id = p_reservation_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Reservation not found');
    END IF;

    IF v_reservation.status = 'cancelled' THEN
        RETURN json_build_object('success', false, 'error', 'Cannot modify cancelled reservation');
    END IF;

    v_customer_name := v_reservation.customer_name;
    
    -- Determinar quién modifica la reserva
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NOT NULL THEN
        SELECT full_name, email INTO v_user_profile 
        FROM profiles 
        WHERE id = v_current_user_id;
        
        v_user_name := COALESCE(v_user_profile.full_name, v_user_profile.email, 'Usuario autenticado');
    ELSE
        v_user_name := v_customer_name;
    END IF;

    -- Preparar valores antiguos y nuevos para auditoría
    v_old_values := jsonb_build_object(
        'date', v_reservation.date,
        'time', v_reservation.time,
        'guests', v_reservation.guests,
        'special_requests', v_reservation.special_requests
    );

    -- Actualizar solo los campos que han cambiado
    UPDATE reservations 
    SET 
        date = COALESCE(p_new_date, date),
        time = COALESCE(p_new_time, time),
        guests = COALESCE(p_new_guests, guests),
        special_requests = COALESCE(p_new_special_requests, special_requests),
        updated_at = NOW()
    WHERE id = p_reservation_id;

    -- Preparar valores nuevos
    v_new_values := jsonb_build_object(
        'date', COALESCE(p_new_date, v_reservation.date),
        'time', COALESCE(p_new_time, v_reservation.time),
        'guests', COALESCE(p_new_guests, v_reservation.guests),
        'special_requests', COALESCE(p_new_special_requests, v_reservation.special_requests)
    );

    -- AUDITORÍA: Registrar modificación de reserva
    PERFORM log_audit_action(
        'reservation_modified',
        'reservations',
        p_reservation_id,
        v_user_name,
        v_current_user_id,
        jsonb_build_object(
            'reservation_id', p_reservation_id,
            'customer_name', v_customer_name,
            'old_values', v_old_values,
            'new_values', v_new_values,
            'modification_reason', p_modification_reason,
            'modified_by_type', CASE WHEN v_current_user_id IS NOT NULL THEN 'admin' ELSE 'customer' END
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Reservation modified successfully',
        'reservation_id', p_reservation_id,
        'old_values', v_old_values,
        'new_values', v_new_values
    );
END;
$$;

-- 4. Función admin_create_reservation CON AUDITORÍA (si existe)
CREATE OR REPLACE FUNCTION admin_create_reservation(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_date DATE,
    p_time TIME,
    p_guests INTEGER,
    p_special_requests TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_existing_customer RECORD;
    v_reservation_result json;
    v_user_name TEXT;
    v_current_user_id UUID;
    v_user_profile RECORD;
BEGIN
    -- Determinar quién crea la reserva
    v_current_user_id := auth.uid();
    
    IF v_current_user_id IS NOT NULL THEN
        SELECT full_name, email INTO v_user_profile 
        FROM profiles 
        WHERE id = v_current_user_id;
        
        v_user_name := COALESCE(v_user_profile.full_name, v_user_profile.email, 'Usuario autenticado');
    ELSE
        v_user_name := 'Sistema';
    END IF;

    -- Buscar cliente existente por teléfono
    SELECT id INTO v_existing_customer
    FROM customers 
    WHERE phone = p_customer_phone
    LIMIT 1;

    IF FOUND THEN
        v_customer_id := v_existing_customer.id;
        
        -- Actualizar información del cliente si es necesario
        UPDATE customers 
        SET 
            name = p_customer_name,
            email = NULLIF(p_customer_email, ''),
            updated_at = NOW()
        WHERE id = v_customer_id;
    ELSE
        -- Crear nuevo cliente
        INSERT INTO customers (
            name, 
            phone, 
            email,
            classification
        )
        VALUES (
            p_customer_name,
            p_customer_phone,
            NULLIF(p_customer_email, ''),
            'NEUTRO'
        )
        RETURNING id INTO v_customer_id;
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

    -- Si la reserva se creó exitosamente, agregar auditoría adicional para admin
    IF (v_reservation_result->>'success')::boolean = true THEN
        PERFORM log_audit_action(
            'reservation_created',
            'reservations',
            (v_reservation_result->>'reservation_id')::UUID,
            v_user_name,
            v_current_user_id,
            jsonb_build_object(
                'created_by_admin', true,
                'customer_name', p_customer_name,
                'customer_phone', p_customer_phone,
                'customer_email', p_customer_email,
                'date', p_date,
                'time', p_time,
                'guests', p_guests,
                'special_requests', p_special_requests,
                'duration_minutes', p_duration_minutes
            )
        );
    END IF;

    RETURN v_reservation_result;
END;
$$;

-- 5. Verificar instalación
SELECT 'AUDITORÍA DE RESERVAS INSTALADA' as status,
       'Funciones de reservas actualizadas con logging de auditoría' as details;
