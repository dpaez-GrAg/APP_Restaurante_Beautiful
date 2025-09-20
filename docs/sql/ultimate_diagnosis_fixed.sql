-- ========================================
-- CREAR USUARIO ADMIN CON UUID ALEATORIO
-- ========================================
-- Las tablas están vacías, usar UUID completamente aleatorio

-- 1. Generar UUID completamente aleatorio y crear usuario
DO $$
DECLARE
    random_uuid uuid := gen_random_uuid();
BEGIN
    -- Mostrar el UUID que se va a usar
    RAISE NOTICE 'Creando usuario con UUID: %', random_uuid;
    
    -- Crear en auth.users
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
        random_uuid,
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
    
    -- Crear en profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        random_uuid,
        'admin@admin.es',
        'Administrador Principal',
        'admin',
        true,
        now(),
        now()
    );
    
    RAISE NOTICE 'Usuario creado exitosamente';
END $$;

-- 2. Verificar resultado
SELECT 
    'SUCCESS' as resultado,
    u.id,
    u.email,
    p.role,
    'Usuario admin creado correctamente' as mensaje
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES:
-- Email: admin@admin.es
-- Contraseña: password
-- ========================================
