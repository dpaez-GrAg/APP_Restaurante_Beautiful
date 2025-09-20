-- ========================================
-- DIAGNÓSTICO ULTIMATE - VER TODO
-- ========================================
-- Este script revela TODO lo que está pasando

-- 1. Ver ABSOLUTAMENTE TODO en profiles (incluso con filtros)
SELECT 
    'PROFILES - TODOS LOS REGISTROS' as tipo,
    id, 
    email, 
    full_name, 
    role, 
    is_active,
    created_at,
    updated_at,
    created_by
FROM profiles 
ORDER BY created_at DESC;

-- 2. Ver ABSOLUTAMENTE TODO en auth.users
SELECT 
    'AUTH.USERS - TODOS LOS REGISTROS' as tipo,
    id, 
    email, 
    role,
    created_at,
    updated_at,
    instance_id
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Buscar registros específicos problemáticos
SELECT 'BUSCAR UUID PROBLEMÁTICO 1' as tipo, * FROM profiles WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
SELECT 'BUSCAR UUID PROBLEMÁTICO 2' as tipo, * FROM profiles WHERE id = '12345678-1234-1234-1234-123456789012';
SELECT 'BUSCAR UUID PROBLEMÁTICO 3' as tipo, * FROM profiles WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- 4. Ver políticas RLS activas
SELECT 
    'POLÍTICAS RLS' as tipo,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. Ver triggers en la tabla profiles
SELECT 
    'TRIGGERS PROFILES' as tipo,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';

-- 6. Ver constraints
SELECT 
    'CONSTRAINTS PROFILES' as tipo,
    constraint_name,
    constraint_type,
    table_name,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'profiles';

-- 7. Intentar usar TRUNCATE con más opciones
-- TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;

-- 8. Ver si hay herencia de tablas
SELECT 
    'HERENCIA TABLAS' as tipo,
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename = 'profiles';

-- ========================================
-- ESTE SCRIPT SOLO DIAGNOSTICA
-- NO MODIFICA NADA
-- ========================================
