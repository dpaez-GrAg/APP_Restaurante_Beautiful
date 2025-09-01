-- First, let's create the admin user if it doesn't exist
-- We'll also disable email confirmation for faster testing

-- Insert admin user directly into auth.users if not exists
DO $$
BEGIN
  -- Create admin user
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    gen_random_uuid(),
    'admin@admin.es',
    crypt('123456', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    false,
    'authenticated'
  )
  ON CONFLICT (email) DO UPDATE SET
    email_confirmed_at = now(),
    updated_at = now();
  
  -- Create corresponding profile
  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name
  ) 
  SELECT 
    u.id,
    u.email,
    'admin',
    'Admin User'
  FROM auth.users u 
  WHERE u.email = 'admin@admin.es'
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    updated_at = now();
    
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Admin user setup completed with some warnings: %', SQLERRM;
END $$;