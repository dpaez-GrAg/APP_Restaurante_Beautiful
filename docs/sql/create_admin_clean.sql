-- ========================================
-- CREAR USUARIO ADMINISTRADOR (CON LIMPIEZA)
-- ========================================
-- Este script limpia cualquier registro existente y crea un usuario admin limpio

-- 1. Limpiar registros existentes (si los hay)
DELETE FROM public.profiles WHERE email = 'admin@admin.es';
DELETE FROM auth.users WHERE email = 'admin@admin.es';

-- 2. Crear el usuario en auth.users (Supabase Auth)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),  -- Generar UUID aleatorio
    'authenticated',
    'authenticated',
    'admin@admin.es',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    false,
    '',
    '',
    '',
    ''
);

-- 3. Crear el perfil en la tabla profiles usando el UUID generado
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
) 
SELECT 
    u.id,
    u.email,
    'Administrador Principal',
    'admin'::user_role,
    true,
    now(),
    now()
FROM auth.users u 
WHERE u.email = 'admin@admin.es';

-- 4. Verificar que se creó correctamente
SELECT 
    'SUCCESS' as resultado,
    u.id as user_id,
    u.email,
    p.role,
    'Usuario y perfil creados correctamente' as mensaje
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES DE ACCESO:
-- Email: admin@admin.es
-- Contraseña: 123456
-- ========================================
