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
    gen_random_uuid(),
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
) ON CONFLICT (email) DO NOTHING;

-- 2. Crear el perfil en la tabla profiles
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
WHERE u.email = 'admin@admin.es'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_active = true,
    full_name = 'Administrador Principal',
    updated_at = now();

-- 3. Verificar que se creó correctamente
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.is_active,
    'Usuario creado correctamente' as status
FROM profiles p 
WHERE p.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES DE ACCESO:
-- Email: admin@admin.es
-- Contraseña: 123456
-- ========================================
