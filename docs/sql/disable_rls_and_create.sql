-- ========================================
-- DESHABILITAR RLS Y CREAR USUARIO
-- ========================================
-- Este script deshabilita temporalmente las políticas de seguridad

-- 1. Deshabilitar RLS en profiles
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Ver qué hay actualmente
SELECT 'PROFILES ANTES' as info, id, email, role FROM profiles;

-- 3. Eliminar todos los registros de profiles
TRUNCATE TABLE public.profiles CASCADE;

-- 4. Eliminar todos los registros de auth.users
DELETE FROM auth.users;

-- 5. Verificar limpieza
SELECT 'PROFILES DESPUÉS TRUNCATE' as info, count(*) as total FROM profiles;
SELECT 'AUTH.USERS DESPUÉS DELETE' as info, count(*) as total FROM auth.users;

-- 6. Crear usuario directamente
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
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
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

-- 7. Crear perfil sin RLS
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'admin@admin.es',
    'Administrador Principal',
    'admin',
    true,
    now(),
    now()
);

-- 8. Reactivar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 9. Verificar resultado
SELECT 
    'SUCCESS' as resultado,
    u.email,
    p.role,
    'Usuario creado correctamente' as mensaje
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES:
-- Email: admin@admin.es
-- Contraseña: password
-- ========================================
