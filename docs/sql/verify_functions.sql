-- ========================================
-- VERIFICAR FUNCIONES EXISTENTES
-- ========================================
-- Este script verifica que todas las funciones necesarias existen

-- 1. Verificar que create_customer_optional_email existe
SELECT 'FUNCIÓN create_customer_optional_email' as check_type,
       proname,
       pg_get_function_arguments(oid) as arguments,
       prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'create_customer_optional_email';

-- 2. Verificar que create_reservation_with_assignment existe
SELECT 'FUNCIÓN create_reservation_with_assignment' as check_type,
       proname,
       pg_get_function_arguments(oid) as arguments,
       prosecdef as security_definer
FROM pg_proc 
WHERE proname = 'create_reservation_with_assignment';

-- 3. Probar la función create_customer_optional_email directamente
SELECT 'TEST create_customer_optional_email' as test_type,
       create_customer_optional_email('Diego Test', '777666555', null) as customer_id;

-- 4. Verificar que el customer se creó
SELECT 'CUSTOMER CREADO' as test_type,
       id, name, email, phone
FROM public.customers 
WHERE name = 'Diego Test'
ORDER BY created_at DESC
LIMIT 1;

-- 5. Limpiar el customer de prueba
DELETE FROM public.customers WHERE name = 'Diego Test';

-- 6. Verificar permisos de RLS (Row Level Security)
SELECT 'RLS CUSTOMERS' as check_type,
       schemaname,
       tablename,
       rowsecurity,
       forcerowsecurity
FROM pg_tables 
WHERE tablename = 'customers';

-- 7. Verificar políticas de RLS si existen
SELECT 'POLÍTICAS RLS' as check_type,
       schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual
FROM pg_policies 
WHERE tablename = 'customers';
