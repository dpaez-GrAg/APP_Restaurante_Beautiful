-- ========================================
-- TEST: DIAGNÓSTICO DE CREACIÓN DE RESERVAS
-- ========================================
-- Este script prueba exactamente lo que está intentando hacer la UI

-- 1. Verificar reservas existentes para mañana (19/09/2025)
SELECT 
  'RESERVAS EXISTENTES 19/09' as test_type,
  r.id,
  c.name,
  r.time,
  r.guests,
  r.status,
  ARRAY_AGG(t.name ORDER BY t.name) as assigned_tables
FROM public.reservations r
JOIN public.customers c ON r.customer_id = c.id
LEFT JOIN public.reservation_table_assignments rta ON r.id = rta.reservation_id
LEFT JOIN public.tables t ON rta.table_id = t.id
WHERE r.date = '2025-09-19'
GROUP BY r.id, c.name, r.time, r.guests, r.status
ORDER BY r.time;

-- 2. Verificar disponibilidad para 2 personas mañana
SELECT 'DISPONIBILIDAD 19/09 PARA 2 PERSONAS' as test_type, * 
FROM get_available_time_slots('2025-09-19', 2, 90);

-- 3. Probar creación de reserva para un horario específico (ejemplo: 14:00)
-- Primero necesitamos un customer_id de prueba
DO $$
DECLARE
  v_customer_id uuid;
  v_result json;
BEGIN
  -- Crear o obtener customer de prueba
  INSERT INTO public.customers (name, email, phone)
  VALUES ('Test User', 'test@example.com', '+34 123 456 789')
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now()
  RETURNING id INTO v_customer_id;
  
  RAISE NOTICE 'Customer ID: %', v_customer_id;
  
  -- Intentar crear reserva para las 14:00 (que debería estar disponible)
  SELECT create_reservation_with_assignment(
    v_customer_id,
    '2025-09-19'::date,
    '14:00'::time,
    2,
    'Reserva de prueba desde script',
    90
  ) INTO v_result;
  
  RAISE NOTICE 'Resultado de creación de reserva: %', v_result;
  
  -- Si la reserva se creó exitosamente, eliminarla para no interferir
  IF (v_result->>'success')::boolean = true THEN
    DELETE FROM public.reservation_table_assignments 
    WHERE reservation_id = (v_result->>'reservation_id')::uuid;
    
    DELETE FROM public.reservations 
    WHERE id = (v_result->>'reservation_id')::uuid;
    
    RAISE NOTICE 'Reserva de prueba eliminada correctamente';
  END IF;
END $$;

-- 4. Verificar que las funciones están actualizadas
SELECT 
  'VERSIÓN DE FUNCIONES' as test_type,
  proname,
  prosrc LIKE '%debug_info%' as has_debug_info,
  prosrc LIKE '%fixed_v2%' as is_fixed_version
FROM pg_proc 
WHERE proname IN ('create_reservation_with_assignment', 'is_table_available')
ORDER BY proname;

-- 5. Probar función auxiliar is_table_available
SELECT 
  'TEST is_table_available' as test_type,
  t.name as table_name,
  is_table_available(
    t.id, 
    '2025-09-19'::date,
    '2025-09-19 14:00:00+02'::timestamptz,
    '2025-09-19 15:30:00+02'::timestamptz
  ) as is_available_14_00
FROM public.tables t
WHERE t.is_active = true
ORDER BY t.name;

-- 6. Verificar límites de comensales para mañana
SELECT check_diners_limit('2025-09-19'::date, '14:00'::time, 2) as diners_limit_check;
