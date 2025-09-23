-- =====================================================
-- SISTEMA DE AUDITORÍA - TU MESA IDEAL
-- =====================================================
-- Registra todas las acciones importantes del sistema
-- con detalles completos y identificación del usuario

-- 1. Crear ENUM para tipos de acción
CREATE TYPE audit_action_type AS ENUM (
    'reservation_created',
    'reservation_cancelled', 
    'reservation_modified',
    'table_created',
    'table_modified',
    'table_deleted',
    'customer_classification_changed',
    'user_created',
    'user_modified',
    'schedule_modified',
    'config_modified'
);

-- 2. Crear tabla de auditoría (muy ligera)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type audit_action_type NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    user_name TEXT NOT NULL, -- Nombre del usuario que ejecuta la acción
    user_id UUID, -- NULL para clientes web, UUID para usuarios autenticados
    details JSONB NOT NULL, -- Detalles específicos de la acción
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_name ON audit_log(user_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);

-- 4. Función helper para registrar auditoría
CREATE OR REPLACE FUNCTION log_audit_action(
    p_action_type audit_action_type,
    p_table_name TEXT,
    p_record_id UUID,
    p_user_name TEXT,
    p_user_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_log (
        action_type,
        table_name, 
        record_id,
        user_name,
        user_id,
        details
    ) VALUES (
        p_action_type,
        p_table_name,
        p_record_id,
        p_user_name,
        p_user_id,
        p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función para obtener logs de auditoría con filtros
CREATE OR REPLACE FUNCTION get_audit_logs(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_search_text TEXT DEFAULT NULL,
    p_action_type audit_action_type DEFAULT NULL,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    action_type audit_action_type,
    table_name TEXT,
    record_id UUID,
    user_name TEXT,
    user_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.action_type,
        al.table_name,
        al.record_id,
        al.user_name,
        al.user_id,
        al.details,
        al.created_at
    FROM audit_log al
    WHERE 
        (p_search_text IS NULL OR al.user_name ILIKE '%' || p_search_text || '%' OR al.details::text ILIKE '%' || p_search_text || '%')
        AND (p_action_type IS NULL OR al.action_type = p_action_type)
        AND (p_start_date IS NULL OR al.created_at >= p_start_date)
        AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger para cambios de clasificación de clientes
CREATE OR REPLACE FUNCTION audit_customer_classification_change()
RETURNS TRIGGER AS $$
DECLARE
    user_profile RECORD;
    user_display_name TEXT;
BEGIN
    -- Obtener información del usuario que hace el cambio
    IF NEW.changed_by IS NOT NULL THEN
        SELECT full_name, email INTO user_profile 
        FROM profiles 
        WHERE id = NEW.changed_by;
        
        user_display_name := COALESCE(user_profile.full_name, user_profile.email, 'Usuario desconocido');
    ELSE
        user_display_name := 'Sistema';
    END IF;

    -- Registrar el cambio en auditoría
    PERFORM log_audit_action(
        'customer_classification_changed',
        'customers',
        NEW.customer_id,
        user_display_name,
        NEW.changed_by,
        jsonb_build_object(
            'customer_id', NEW.customer_id,
            'old_classification', OLD.new_classification,
            'new_classification', NEW.new_classification,
            'notes', NEW.notes
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para clasificación de clientes
DROP TRIGGER IF EXISTS trigger_audit_customer_classification ON customer_classification_history;
CREATE TRIGGER trigger_audit_customer_classification
    AFTER INSERT ON customer_classification_history
    FOR EACH ROW
    EXECUTE FUNCTION audit_customer_classification_change();

-- 7. Trigger para cambios en mesas
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type_val audit_action_type;
    user_profile RECORD;
    user_display_name TEXT;
    current_user_id UUID;
BEGIN
    -- Determinar tipo de acción
    IF TG_OP = 'INSERT' THEN
        action_type_val := 'table_created';
    ELSIF TG_OP = 'UPDATE' THEN
        action_type_val := 'table_modified';
    ELSIF TG_OP = 'DELETE' THEN
        action_type_val := 'table_deleted';
    END IF;

    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    IF current_user_id IS NOT NULL THEN
        SELECT full_name, email INTO user_profile 
        FROM profiles 
        WHERE id = current_user_id;
        
        user_display_name := COALESCE(user_profile.full_name, user_profile.email, 'Usuario autenticado');
    ELSE
        user_display_name := 'Sistema';
    END IF;

    -- Registrar en auditoría
    IF TG_OP = 'DELETE' THEN
        PERFORM log_audit_action(
            action_type_val,
            'tables',
            OLD.id,
            user_display_name,
            current_user_id,
            jsonb_build_object(
                'table_number', OLD.table_number,
                'capacity', OLD.capacity,
                'location', OLD.location
            )
        );
        RETURN OLD;
    ELSE
        PERFORM log_audit_action(
            action_type_val,
            'tables',
            NEW.id,
            user_display_name,
            current_user_id,
            jsonb_build_object(
                'table_number', NEW.table_number,
                'capacity', NEW.capacity,
                'location', NEW.location,
                'is_active', NEW.is_active
            )
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para mesas
DROP TRIGGER IF EXISTS trigger_audit_tables_insert ON tables;
DROP TRIGGER IF EXISTS trigger_audit_tables_update ON tables;
DROP TRIGGER IF EXISTS trigger_audit_tables_delete ON tables;

CREATE TRIGGER trigger_audit_tables_insert
    AFTER INSERT ON tables
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trigger_audit_tables_update
    AFTER UPDATE ON tables
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trigger_audit_tables_delete
    AFTER DELETE ON tables
    FOR EACH ROW
    EXECUTE FUNCTION audit_table_changes();

-- 8. Trigger para cambios en usuarios
CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type_val audit_action_type;
    current_user_profile RECORD;
    user_display_name TEXT;
    current_user_id UUID;
BEGIN
    -- Determinar tipo de acción
    IF TG_OP = 'INSERT' THEN
        action_type_val := 'user_created';
    ELSIF TG_OP = 'UPDATE' THEN
        action_type_val := 'user_modified';
    END IF;

    -- Obtener usuario actual
    current_user_id := auth.uid();
    
    IF current_user_id IS NOT NULL THEN
        SELECT full_name, email INTO current_user_profile 
        FROM profiles 
        WHERE id = current_user_id;
        
        user_display_name := COALESCE(current_user_profile.full_name, current_user_profile.email, 'Usuario autenticado');
    ELSE
        user_display_name := 'Sistema';
    END IF;

    -- Registrar en auditoría
    PERFORM log_audit_action(
        action_type_val,
        'profiles',
        NEW.id,
        user_display_name,
        current_user_id,
        jsonb_build_object(
            'target_user_email', NEW.email,
            'target_user_name', NEW.full_name,
            'target_user_role', NEW.role,
            'is_active', NEW.is_active
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para usuarios
DROP TRIGGER IF EXISTS trigger_audit_profiles_insert ON profiles;
DROP TRIGGER IF EXISTS trigger_audit_profiles_update ON profiles;

CREATE TRIGGER trigger_audit_profiles_insert
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_changes();

CREATE TRIGGER trigger_audit_profiles_update
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_changes();

-- 9. Políticas RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver logs de auditoría
CREATE POLICY "Only admins can read audit logs" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Solo el sistema puede insertar logs (a través de funciones)
CREATE POLICY "System can insert audit logs" ON audit_log
    FOR INSERT WITH CHECK (true);

-- 10. Función para limpiar logs antiguos (opcional, para uso futuro)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
    p_days_to_keep INTEGER DEFAULT 365
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Verificar instalación
SELECT 'SISTEMA DE AUDITORÍA INSTALADO' as status,
       'Tabla audit_log creada con triggers automáticos' as details;
