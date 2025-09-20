-- ========================================
-- FORZAR LIMPIEZA Y CREAR ADMIN
-- ========================================
-- Este script fuerza la limpieza completa y crea el usuario admin

-- 1. Ver qué hay actualmente
SELECT 'ANTES DE LIMPIAR - auth.users' as tabla, id, email FROM auth.users WHERE email = 'admin@admin.es';
SELECT 'ANTES DE LIMPIAR - profiles' as tabla, id, email FROM profiles WHERE email = 'admin@admin.es';

-- 2. Forzar limpieza completa
DELETE FROM public.profiles WHERE email = 'admin@admin.es' OR id = '71486b16-a95b-4a9c-a0df-b1a1e54c2b3c';
DELETE FROM auth.users WHERE email = 'admin@admin.es' OR id = '71486b16-a95b-4a9c-a0df-b1a1e54c2b3c';

-- 3. Verificar que se limpiaron
SELECT 'DESPUÉS DE LIMPIAR - auth.users' as tabla, count(*) as registros FROM auth.users WHERE email = 'admin@admin.es';
SELECT 'DESPUÉS DE LIMPIAR - profiles' as tabla, count(*) as registros FROM profiles WHERE email = 'admin@admin.es';

-- 4. Crear usuario con UUID completamente nuevo
DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Insertar en auth.users
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
        new_user_id,
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

    -- Insertar en profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        'admin@admin.es',
        'Administrador Principal',
        'admin',
        true,
        now(),
        now()
    );

    -- Mostrar resultado
    RAISE NOTICE 'Usuario creado con ID: %', new_user_id;
END $$;

-- 5. Verificar creación final
SELECT 
    'RESULTADO FINAL' as estado,
    u.id as user_id,
    u.email,
    p.role,
    'SUCCESS - Usuario y perfil creados' as mensaje
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES DE ACCESO:
-- Email: admin@admin.es
-- Contraseña: 123456
-- ========================================
