-- ============================================
-- CORRECCIONES CRÍTICAS PARA GOTURE
-- ============================================
-- Este archivo corrige problemas de compatibilidad con GoTrue v2.174.0
-- Ejecutar DESPUÉS de 01-06 si tienes problemas de login

-- 1. Asegurar que extensión pgcrypto esté en schema correcto
ALTER DATABASE postgres SET search_path TO public, auth, extensions;

-- 2. Actualizar usuarios existentes con campos correctos
UPDATE auth.users
SET 
    email_change = COALESCE(email_change, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, '')
WHERE 
    email_change IS NULL OR phone_change IS NULL OR phone_change_token IS NULL
    OR email_change_token_current IS NULL OR reauthentication_token IS NULL
    OR confirmation_token IS NULL OR recovery_token IS NULL OR email_change_token_new IS NULL;

-- 3. Cambiar defaults para futuros inserts
ALTER TABLE auth.users 
    ALTER COLUMN email_change SET DEFAULT '',
    ALTER COLUMN phone_change SET DEFAULT '',
    ALTER COLUMN phone_change_token SET DEFAULT '',
    ALTER COLUMN email_change_token_current SET DEFAULT '',
    ALTER COLUMN reauthentication_token SET DEFAULT '',
    ALTER COLUMN confirmation_token SET DEFAULT '',
    ALTER COLUMN recovery_token SET DEFAULT '',
    ALTER COLUMN email_change_token_new SET DEFAULT '';

-- 4. Crear identities para usuarios sin identity
INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT 
    u.id::text,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email',
    now(),
    u.created_at,
    u.updated_at
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

-- 5. Políticas service_role para GoTrue (crítico para self-hosted)
DO $$
BEGIN
    -- Crear políticas si no existen
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_auth_users') THEN
        CREATE POLICY service_role_all_auth_users ON auth.users FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_auth_identities') THEN
        CREATE POLICY service_role_all_auth_identities ON auth.identities FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_auth_sessions') THEN
        CREATE POLICY service_role_all_auth_sessions ON auth.sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_auth_refresh_tokens') THEN
        CREATE POLICY service_role_all_auth_refresh_tokens ON auth.refresh_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

RAISE NOTICE '✅ Auth fixes applied successfully';