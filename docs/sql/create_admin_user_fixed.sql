-- ========================================
-- CREAR USUARIO ADMINISTRADOR INICIAL
-- ========================================
-- Este script crea el primer usuario administrador del sistema

-- 1. Crear el usuario en auth.users (Supabase Auth)
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
    '11111111-1111-1111-1111-111111111111',  -- UUID fijo para admin
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

-- 2. Crear el perfil en la tabla profiles
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',  -- Mismo UUID que auth.users
    'admin@admin.es',
    'Administrador Principal',
    'admin',
    true,
    now(),
    now()
);

-- 3. Verificar que se creó correctamente
SELECT 
    'auth.users' as tabla,
    u.id,
    u.email,
    u.role,
    'Usuario creado en auth.users' as status
FROM auth.users u 
WHERE u.email = 'admin@admin.es'

UNION ALL

SELECT 
    'profiles' as tabla,
    p.id,
    p.email,
    p.role::text,
    'Perfil creado en profiles' as status
FROM profiles p 
WHERE p.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES DE ACCESO:
-- Email: admin@admin.es
-- Contraseña: 123456
-- ========================================
