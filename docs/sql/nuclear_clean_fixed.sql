-- ========================================
-- LIMPIEZA NUCLEAR - ELIMINAR TODO (CORREGIDO)
-- ========================================
-- Este script elimina TODOS los registros y crea uno limpio

-- 1. Ver TODO lo que hay (incluso registros ocultos)
SELECT 'TODOS AUTH.USERS' as info, id, email, created_at FROM auth.users ORDER BY created_at;
SELECT 'TODOS PROFILES' as info, id, email, full_name, role FROM profiles ORDER BY created_at;

-- 2. ELIMINAR TODO de profiles
DELETE FROM public.profiles;

-- 3. ELIMINAR TODO de auth.users  
DELETE FROM auth.users;

-- 4. Verificar que está todo limpio
SELECT 'AUTH.USERS DESPUÉS' as tabla, count(*) as total FROM auth.users;
SELECT 'PROFILES DESPUÉS' as tabla, count(*) as total FROM profiles;

-- 5. Crear usuario completamente limpio con UUID válido
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
    '12345678-1234-1234-1234-123456789012',  -- UUID válido y fácil de recordar
    'authenticated',
    'authenticated',
    'admin@admin.es',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- password: password
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

-- 6. Crear perfil correspondiente
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    '12345678-1234-1234-1234-123456789012',  -- Mismo UUID válido
    'admin@admin.es',
    'Administrador Principal',
    'admin',
    true,
    now(),
    now()
);

-- 7. Verificar resultado final
SELECT 
    'ÉXITO' as resultado,
    u.id,
    u.email,
    p.role,
    'Usuario admin creado correctamente' as mensaje
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'admin@admin.es';

-- ========================================
-- CREDENCIALES FINALES:
-- Email: admin@admin.es
-- Contraseña: password
-- ========================================
