-- ========================================
-- VERIFICAR Y LIMPIAR REGISTROS EXISTENTES
-- ========================================

-- 1. Ver qué hay actualmente
SELECT 'AUTH.USERS EXISTENTES' as tabla, id, email, created_at FROM auth.users;
SELECT 'PROFILES EXISTENTES' as tabla, id, email, role FROM profiles;

-- 2. Limpiar registros con UUID fijo si existen
DELETE FROM public.profiles WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM auth.users WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- 3. Verificar limpieza
SELECT 'DESPUÉS DE LIMPIAR - AUTH.USERS' as tabla, count(*) as total FROM auth.users;
SELECT 'DESPUÉS DE LIMPIAR - PROFILES' as tabla, count(*) as total FROM profiles;

-- 4. Crear con UUID completamente nuevo
DO $$
DECLARE
    new_uuid uuid := gen_random_uuid();
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
        is_super_admin
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_uuid,
        'authenticated',
        'authenticated',
        'admin@admin.es',
        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        now(),
        now(),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        false
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
        new_uuid,
        'admin@admin.es',
        'Administrador Principal',
        'admin',
        true,
        now(),
        now()
    );

    RAISE NOTICE 'Usuario creado con UUID: %', new_uuid;
END $$;

-- 5. Verificar resultado final
SELECT 
    'RESULTADO FINAL' as estado,
    u.id,
    u.email,
    p.role,
    'SUCCESS' as mensaje
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES:
-- Email: admin@admin.es
-- Contraseña: password
-- ========================================
