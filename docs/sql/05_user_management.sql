-- ========================================
-- SISTEMA DE GESTIÓN DE USUARIOS
-- ========================================
-- Este archivo contiene el sistema completo de gestión de usuarios:
-- - Roles: admin y user
-- - Permisos granulares
-- - Funciones de administración de usuarios

-- ========================================
-- USER MANAGEMENT SYSTEM - DATABASE UPDATES
-- ========================================
-- This script adds user management functionality to the existing system
-- Execute this after the main bootstrap to add user roles and permissions

-- Create user role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing profiles to have admin role (for current users)
UPDATE public.profiles 
SET role = 'admin', is_active = true, updated_at = now()
WHERE role IS NULL OR role != 'admin';

-- Create function to manage user creation by admins
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role user_role DEFAULT 'user'
)
RETURNS JSON AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RETURN json_build_object('error', 'Email already exists');
    END IF;

    -- CRÍTICO: Usar extensions.crypt y todos los campos como strings vacíos
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmed_at, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', p_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')),
        now(), now(), now(), now(),
        '', '', '', '',  -- IMPORTANTE: Strings vacíos, no NULL
        '', '', '', ''   -- IMPORTANTE: Strings vacíos, no NULL
    ) RETURNING id INTO new_user_id;

    -- NUEVO: Crear identity (obligatorio)
    INSERT INTO auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        new_user_id::text, new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', p_email, 'email_verified', true),
        'email', now(), now(), now()
    );

    INSERT INTO public.profiles (
        id, email, full_name, role, is_active, created_by, created_at, updated_at
    ) VALUES (
        new_user_id, p_email, COALESCE(p_full_name, p_email),
        p_role, true, auth.uid(), now(), now()
    );

    RETURN json_build_object('success', true, 'user_id', new_user_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user details (admin only)
CREATE OR REPLACE FUNCTION public.admin_update_user(
    p_user_id UUID,
    p_full_name TEXT DEFAULT NULL,
    p_role user_role DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RETURN json_build_object('error', 'Unauthorized: Only admins can update users');
    END IF;

    -- Check if target user exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    -- Update profile
    UPDATE public.profiles 
    SET 
        full_name = COALESCE(p_full_name, full_name),
        role = COALESCE(p_role, role),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'message', 'User updated successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to change user password (admin only)
CREATE OR REPLACE FUNCTION public.admin_change_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS JSON AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    -- CRÍTICO: Usar extensions.crypt
    UPDATE auth.users 
    SET 
        encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Failed to update password');
    END IF;

    RETURN json_build_object('success', true, 'message', 'Password updated');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role user_role,
    is_active BOOLEAN,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    creator_name TEXT
) AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can view users';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.role,
        p.is_active,
        p.created_by,
        p.created_at,
        p.updated_at,
        creator.full_name as creator_name
    FROM public.profiles p
    LEFT JOIN public.profiles creator ON p.created_by = creator.id
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ELIMINAR políticas recursivas
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can insert profiles" ON public.profiles;

-- CREAR políticas simples sin recursión
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Política adicional para anon (necesaria para login)
CREATE POLICY "Allow anon read for auth flow"
ON public.profiles FOR SELECT
TO anon
USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users TO authenticated;
