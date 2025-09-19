-- ========================================
-- SISTEMA DE CLASIFICACIÓN DE CLIENTES
-- ========================================
-- Añade clasificación de clientes con historial de cambios

-- 1. Crear enum para las clasificaciones
CREATE TYPE customer_classification AS ENUM ('VIP', 'NEUTRO', 'ALERTA', 'RED_FLAG');

-- 2. Añadir campos a la tabla customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS classification customer_classification DEFAULT 'NEUTRO',
ADD COLUMN IF NOT EXISTS classification_notes TEXT,
ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS classification_updated_by UUID REFERENCES auth.users(id);

-- 3. Crear tabla para historial de cambios de clasificación
CREATE TABLE IF NOT EXISTS customer_classification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    old_classification customer_classification,
    new_classification customer_classification NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_customers_classification ON customers(classification);
CREATE INDEX IF NOT EXISTS idx_customers_classification_updated_at ON customers(classification_updated_at);
CREATE INDEX IF NOT EXISTS idx_customer_classification_history_customer_id ON customer_classification_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_classification_history_changed_at ON customer_classification_history(changed_at);

-- 5. Crear función para actualizar clasificación con historial
CREATE OR REPLACE FUNCTION update_customer_classification(
    p_customer_id UUID,
    p_new_classification customer_classification,
    p_notes TEXT DEFAULT NULL,
    p_changed_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_classification customer_classification;
BEGIN
    -- Obtener clasificación actual
    SELECT classification INTO v_old_classification 
    FROM customers 
    WHERE id = p_customer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado';
    END IF;
    
    -- Solo actualizar si la clasificación cambió
    IF v_old_classification != p_new_classification THEN
        -- Actualizar customer
        UPDATE customers 
        SET 
            classification = p_new_classification,
            classification_notes = p_notes,
            classification_updated_at = NOW(),
            classification_updated_by = p_changed_by,
            updated_at = NOW()
        WHERE id = p_customer_id;
        
        -- Insertar en historial
        INSERT INTO customer_classification_history (
            customer_id,
            old_classification,
            new_classification,
            notes,
            changed_by
        ) VALUES (
            p_customer_id,
            v_old_classification,
            p_new_classification,
            p_notes,
            p_changed_by
        );
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Crear función para obtener clientes con información de reservas
CREATE OR REPLACE FUNCTION get_customers_with_stats(
    p_search TEXT DEFAULT NULL,
    p_classification customer_classification DEFAULT NULL,
    p_order_by TEXT DEFAULT 'name',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    email TEXT,
    classification customer_classification,
    classification_notes TEXT,
    classification_updated_at TIMESTAMP WITH TIME ZONE,
    total_reservations BIGINT,
    last_reservation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.classification,
        c.classification_notes,
        c.classification_updated_at,
        COALESCE(r.total_reservations, 0) as total_reservations,
        r.last_reservation_date,
        c.created_at
    FROM customers c
    LEFT JOIN (
        SELECT 
            customer_id,
            COUNT(*) as total_reservations,
            MAX(date) as last_reservation_date
        FROM reservations 
        WHERE status IN ('confirmed', 'completed')
        GROUP BY customer_id
    ) r ON c.id = r.customer_id
    WHERE 
        (p_search IS NULL OR 
         c.name ILIKE '%' || p_search || '%' OR 
         c.phone ILIKE '%' || p_search || '%')
        AND (p_classification IS NULL OR c.classification = p_classification)
    ORDER BY 
        CASE 
            WHEN p_order_by = 'name' THEN c.name
            WHEN p_order_by = 'classification' THEN c.classification::text
            WHEN p_order_by = 'last_reservation' THEN r.last_reservation_date::text
            ELSE c.name
        END
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Crear función para obtener historial de clasificación de un cliente
CREATE OR REPLACE FUNCTION get_customer_classification_history(
    p_customer_id UUID
) RETURNS TABLE (
    id UUID,
    old_classification customer_classification,
    new_classification customer_classification,
    notes TEXT,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.old_classification,
        h.new_classification,
        h.notes,
        h.changed_by,
        h.changed_at
    FROM customer_classification_history h
    WHERE h.customer_id = p_customer_id
    ORDER BY h.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Crear políticas RLS (Row Level Security)
ALTER TABLE customer_classification_history ENABLE ROW LEVEL SECURITY;

-- Política para leer historial (usuarios autenticados)
CREATE POLICY "Users can read classification history" ON customer_classification_history
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para insertar historial (usuarios autenticados)
CREATE POLICY "Users can insert classification history" ON customer_classification_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 9. Verificar instalación
SELECT 'CLASIFICACIÓN DE CLIENTES INSTALADA' as status,
       COUNT(*) as total_customers,
       COUNT(CASE WHEN classification = 'VIP' THEN 1 END) as vip_customers,
       COUNT(CASE WHEN classification = 'NEUTRO' THEN 1 END) as neutro_customers,
       COUNT(CASE WHEN classification = 'ALERTA' THEN 1 END) as alerta_customers,
       COUNT(CASE WHEN classification = 'RED_FLAG' THEN 1 END) as red_flag_customers
FROM customers;
