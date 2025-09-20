-- ========================================
-- DIAGNÓSTICO COMPLETO DE TABLAS
-- ========================================
-- Este script diagnostica qué está pasando con las tablas

-- 1. Ver TODOS los registros en profiles
SELECT 'TODOS LOS PROFILES' as info, id, email, full_name, role, is_active 
FROM profiles 
ORDER BY created_at DESC;

-- 2. Ver TODOS los registros en auth.users
SELECT 'TODOS LOS AUTH.USERS' as info, id, email, role, created_at 
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Buscar registros específicos problemáticos
SELECT 'PROFILES CON ADMIN EMAIL' as info, id, email, full_name 
FROM profiles 
WHERE email = 'admin@admin.es' OR email LIKE '%admin%';

-- 4. Buscar por los UUIDs problemáticos
SELECT 'PROFILES CON UUID PROBLEMÁTICO 1' as info, id, email 
FROM profiles 
WHERE id = '71486b16-a95b-4a9c-a0df-b1a1e54c2b3c';

SELECT 'PROFILES CON UUID PROBLEMÁTICO 2' as info, id, email 
FROM profiles 
WHERE id = 'b3af42bc-1c07-45ce-a4dd-aa8057af35c9';

-- 5. Contar total de registros
SELECT 'TOTAL PROFILES' as info, count(*) as total FROM profiles;
SELECT 'TOTAL AUTH.USERS' as info, count(*) as total FROM auth.users;

-- 6. Ver estructura de la tabla profiles
SELECT 'ESTRUCTURA PROFILES' as info, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public';

-- ========================================
-- EJECUTA ESTE SCRIPT PARA VER QUÉ PASA
-- ========================================
