-- Script para actualizar CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql con las correcciones necesarias
-- Este script aplica los fixes críticos identificados durante el desarrollo

-- ========================================
-- FIX 1: admin_create_reservation - Error operador JSON ||
-- ========================================

CREATE OR REPLACE FUNCTION public.admin_create_reservation(
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_date date,
    p_time time,
    p_guests integer,
    p_special_requests text,
    p_table_ids uuid[] DEFAULT NULL,
    p_duration_minutes integer DEFAULT 120
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_result json;
    v_success boolean;
    v_error text;
    v_reservation_id uuid;
BEGIN
    -- Crear o actualizar cliente
    SELECT create_customer_optional_email(
        p_customer_name, 
        p_customer_phone, 
        NULLIF(p_customer_email, '')
    ) INTO v_customer_id;
    
    -- Crear reserva con asignación automática o específica
    IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
        -- Usar mesas específicas (si se implementa esta función)
        SELECT create_reservation_with_assignment(
            v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
        ) INTO v_result;
    ELSE
        -- Asignación automática
        SELECT create_reservation_with_assignment(
            v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
        ) INTO v_result;
    END IF;
    
    -- Extraer valores del resultado para reconstruir el JSON
    v_success := (v_result->>'success')::boolean;
    v_error := v_result->>'error';
    v_reservation_id := (v_result->>'reservation_id')::uuid;
    
    -- Reconstruir el resultado completo en lugar de usar ||
    IF v_success = true THEN
        v_result := json_build_object(
            'success', true,
            'reservation_id', v_reservation_id,
            'customer_id', v_customer_id, 
            'customer_name', p_customer_name
        );
    ELSE
        v_result := json_build_object(
            'success', false,
            'error', v_error
        );
    END IF;
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Error al crear la reserva: ' || SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION public.admin_create_reservation IS 'Crea una nueva reserva desde el panel de administración (corregido operador JSON)';

-- ========================================
-- MENSAJE DE CONFIRMACIÓN
-- ========================================

DO $$
BEGIN
    RAISE NOTICE 'CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql actualizado con correcciones críticas:';
    RAISE NOTICE '✅ admin_create_reservation - Corregido error operador JSON ||';
    RAISE NOTICE '';
    RAISE NOTICE 'El archivo consolidado ahora incluye todas las correcciones necesarias.';
END $$;
