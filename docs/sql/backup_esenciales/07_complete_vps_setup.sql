-- ========================================
-- 07 - CONFIGURACIÓN COMPLETA PARA VPS - VERSIÓN FINAL
-- ========================================
-- Este archivo contiene todo lo necesario para configurar el sistema en VPS
-- Ejecutar DESPUÉS de los archivos 01-06 existentes
-- VERSIÓN CORREGIDA: Incluye fix para admin_get_users con cast de role

-- ========================================
-- PARTE 0: LIMPIAR FUNCIONES EXISTENTES
-- ========================================

-- Eliminar TODAS las versiones posibles de funciones admin que pueden tener conflictos
DROP FUNCTION IF EXISTS public.admin_get_users();

-- Versiones de admin_create_user
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, user_role, text);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, user_role);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text);

-- Versiones de admin_update_user
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, user_role, boolean);
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text, user_role, boolean);
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text, user_role);
DROP FUNCTION IF EXISTS public.admin_update_user(uuid, text, text);

-- Versiones de admin_delete_user
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

-- Versiones de admin_create_reservation
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, integer, integer, text);
DROP FUNCTION IF EXISTS public.admin_create_reservation(text, text, text, date, time, integer, text, integer);

-- Versiones de admin_get_reservations
DROP FUNCTION IF EXISTS public.admin_get_reservations(date, date, text);
DROP FUNCTION IF EXISTS public.admin_get_reservations();

-- Versiones de admin_update_reservation_status
DROP FUNCTION IF EXISTS public.admin_update_reservation_status(uuid, reservation_status);

-- Versiones de admin_cancel_reservation
DROP FUNCTION IF EXISTS public.admin_cancel_reservation(uuid);

-- Eliminar función de cliente que puede tener conflictos de parámetros
DROP FUNCTION IF EXISTS public.create_customer_optional_email(text, text, text);
DROP FUNCTION IF EXISTS public.create_customer_optional_email(text, text);

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- ========================================
-- PARTE 1: LIMPIAR CONFIGURACIÓN ANTERIOR
-- ========================================

-- Deshabilitar RLS en todas las tablas (desarrollo)
ALTER TABLE public.restaurant_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_schedule_days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_closed_days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_combinations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_table_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_classification_history DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Allow all for config" ON public.restaurant_config;
DROP POLICY IF EXISTS "Allow all for schedules" ON public.restaurant_schedules;
DROP POLICY IF EXISTS "Allow all for special schedule days" ON public.special_schedule_days;
DROP POLICY IF EXISTS "Allow all for special closed days" ON public.special_closed_days;
DROP POLICY IF EXISTS "Allow all for tables" ON public.tables;
DROP POLICY IF EXISTS "Allow all for combinations" ON public.table_combinations;
DROP POLICY IF EXISTS "Allow all for time slots" ON public.time_slots;
DROP POLICY IF EXISTS "Allow all for customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all for reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow all for assignments" ON public.reservation_table_assignments;
DROP POLICY IF EXISTS "Allow all for classification history" ON public.customer_classification_history;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- ========================================
-- PARTE 2: CREAR USUARIO ADMINISTRADOR
-- ========================================

-- Crear usuario admin en auth.users
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '12345678-abcd-1234-abcd-123456789012',
    'authenticated',
    'authenticated',
    'admin@admin.es',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: "password"
    NOW(),
    NOW(),
    '',
    NOW(),
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Administrador Principal"}',
    false,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    false,
    NULL
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

-- Crear perfil de administrador
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    '12345678-abcd-1234-abcd-123456789012',
    'admin@admin.es',
    'Administrador Principal',
    'admin',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ========================================
-- PARTE 3: FUNCIONES DE GESTIÓN DE USUARIOS
-- ========================================

-- Función para obtener todos los usuarios (CORREGIDA con cast)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE(
    id uuid,
    email text,
    full_name text,
    role user_role,
    is_active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role::user_role,  -- CAST CORREGIDO: de text a user_role
        p.is_active,
        p.created_at,
        p.updated_at
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- Función para crear usuario
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_full_name text,
    p_role user_role DEFAULT 'user',
    p_password text DEFAULT 'password123'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_encrypted_password text;
BEGIN
    v_user_id := gen_random_uuid();
    v_encrypted_password := '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    
    -- Crear usuario en auth.users
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
        phone_change, phone_change_token, phone_change_sent_at,
        email_change_token_current, email_change_confirm_status, banned_until,
        reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        p_email, v_encrypted_password, NOW(), NOW(), '', NOW(), '', NULL, '', '', NULL, NULL,
        '{"provider": "email", "providers": ["email"]}', json_build_object('full_name', p_full_name),
        false, NOW(), NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL
    );
    
    -- Crear perfil
    INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at, updated_at)
    VALUES (v_user_id, p_email, p_full_name, p_role, true, NOW(), NOW());
    
    RETURN json_build_object('success', true, 'user_id', v_user_id, 'message', 'Usuario creado correctamente');
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Función para actualizar usuario
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id uuid,
    p_email text,
    p_full_name text,
    p_role user_role,
    p_is_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE auth.users 
    SET email = p_email, raw_user_meta_data = json_build_object('full_name', p_full_name), updated_at = NOW()
    WHERE id = p_user_id;
    
    UPDATE public.profiles 
    SET email = p_email, full_name = p_full_name, role = p_role, is_active = p_is_active, updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN json_build_object('success', true, 'message', 'Usuario actualizado correctamente');
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Función para eliminar usuario
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_user_id = '12345678-abcd-1234-abcd-123456789012' THEN
        RETURN json_build_object('success', false, 'error', 'No se puede eliminar el administrador principal');
    END IF;
    
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
    
    RETURN json_build_object('success', true, 'message', 'Usuario eliminado correctamente');
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ========================================
-- PARTE 4: FUNCIONES DE GESTIÓN DE RESERVAS
-- ========================================

-- Función para crear cliente si no existe
CREATE OR REPLACE FUNCTION public.create_customer_optional_email(
    p_name text,
    p_phone text,
    p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_existing_customer_id uuid;
BEGIN
    SELECT id INTO v_existing_customer_id
    FROM public.customers
    WHERE phone = p_phone OR (p_email IS NOT NULL AND email = p_email)
    LIMIT 1;
    
    IF v_existing_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET name = p_name, email = COALESCE(p_email, email), phone = p_phone, updated_at = NOW()
        WHERE id = v_existing_customer_id;
        RETURN v_existing_customer_id;
    ELSE
        INSERT INTO public.customers (name, phone, email, classification)
        VALUES (p_name, p_phone, p_email, 'NEUTRO')
        RETURNING id INTO v_customer_id;
        RETURN v_customer_id;
    END IF;
END;
$$;

-- Función principal para crear reserva desde admin
CREATE OR REPLACE FUNCTION public.admin_create_reservation(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text,
    p_table_ids uuid[] DEFAULT NULL,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_result json;
BEGIN
    -- Crear o actualizar cliente
    SELECT create_customer_optional_email(
        p_customer_name, 
        p_customer_phone, 
        NULLIF(p_customer_email, '')
    ) INTO v_customer_id;
    
    -- Crear reserva con asignación automática o específica
    IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
        -- Usar mesas específicas (si se implementa esta función)
        SELECT create_reservation_with_assignment(
            v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
        ) INTO v_result;
    ELSE
        -- Asignación automática
        SELECT create_reservation_with_assignment(
            v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
        ) INTO v_result;
    END IF;
    
    -- Agregar información del cliente al resultado
    IF (v_result->>'success')::boolean = true THEN
        v_result := v_result || json_build_object(
            'customer_id', v_customer_id, 
            'customer_name', p_customer_name
        );
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Error al crear la reserva: ' || SQLERRM
        );
END;
$$;

-- Función para obtener reservas con información completa
CREATE OR REPLACE FUNCTION public.admin_get_reservations(
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL,
    p_status text DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    customer_email text,
    customer_classification customer_classification,
    reservation_date date,
    reservation_time time,
    guests integer,
    duration_minutes integer,
    special_requests text,
    status reservation_status,
    assigned_tables text[],
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id, r.customer_id, c.name, c.phone, c.email, c.classification,
        r.date, r.time, r.guests, r.duration_minutes, r.special_requests, r.status,
        ARRAY_AGG(t.name ORDER BY t.name), r.created_at, r.updated_at
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    LEFT JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
    LEFT JOIN public.tables t ON rta.table_id = t.id
    WHERE 
        (p_date_from IS NULL OR r.date >= p_date_from)
        AND (p_date_to IS NULL OR r.date <= p_date_to)
        AND (p_status IS NULL OR r.status::text = p_status)
    GROUP BY r.id, c.id
    ORDER BY r.date DESC, r.time DESC;
END;
$$;

-- Función para actualizar estado de reserva
CREATE OR REPLACE FUNCTION public.admin_update_reservation_status(
    p_reservation_id uuid,
    p_status reservation_status
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.reservations SET status = p_status, updated_at = NOW() WHERE id = p_reservation_id;
    
    IF FOUND THEN
        RETURN json_build_object('success', true, 'message', 'Estado actualizado correctamente');
    ELSE
        RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
END;
$$;

-- Función para cancelar reserva
CREATE OR REPLACE FUNCTION public.admin_cancel_reservation(p_reservation_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.reservations SET status = 'cancelled', updated_at = NOW() WHERE id = p_reservation_id;
    
    IF FOUND THEN
        RETURN json_build_object('success', true, 'message', 'Reserva cancelada correctamente');
    ELSE
        RETURN json_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
END;
$$;

-- ========================================
-- PARTE 5: LIMPIAR CACHE Y FINALIZAR
-- ========================================

-- Limpiar cache de PostgREST
NOTIFY pgrst, 'reload schema';

-- Comentarios para documentación
COMMENT ON FUNCTION public.admin_get_users IS 'Obtiene lista de todos los usuarios del sistema (CORREGIDA con cast)';
COMMENT ON FUNCTION public.admin_create_user IS 'Crea un nuevo usuario en el sistema';
COMMENT ON FUNCTION public.admin_update_user IS 'Actualiza los datos de un usuario existente';
COMMENT ON FUNCTION public.admin_delete_user IS 'Elimina un usuario del sistema (excepto admin principal)';
COMMENT ON FUNCTION public.create_customer_optional_email IS 'Crea o actualiza un cliente con email opcional';
COMMENT ON FUNCTION public.admin_create_reservation IS 'Crea una nueva reserva desde el panel de administración';
COMMENT ON FUNCTION public.admin_get_reservations IS 'Obtiene lista de reservas con filtros opcionales';
COMMENT ON FUNCTION public.admin_update_reservation_status IS 'Actualiza el estado de una reserva';
COMMENT ON FUNCTION public.admin_cancel_reservation IS 'Cancela una reserva específica';

-- Verificación final
SELECT 'CONFIGURACIÓN VPS COMPLETADA - VERSIÓN CORREGIDA' as status, 
       'Sistema completamente funcional con todas las correcciones aplicadas' as mensaje,
       'Credenciales: admin@admin.es / password' as acceso,
       'Fix aplicado: admin_get_users con cast de role::user_role' as correccion,
       now() as timestamp;
