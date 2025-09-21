-- Basic seed data for local development
-- This file will be loaded when running `supabase db reset`

-- Create admin user first
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'admin000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@admin.es',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- Create admin profile
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'admin000-0000-0000-0000-000000000001',
  'admin@admin.es',
  'Administrador Principal',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert sample restaurant configuration
INSERT INTO restaurant_config (id, name, description, address, phone, email, capacity, created_at, updated_at) 
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tu Mesa Ideal - Local Dev',
  'Restaurante de desarrollo local',
  'Calle Principal 123, Ciudad',
  '+34 123 456 789',
  'info@tumesaideal.local',
  50,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Insert sample tables
INSERT INTO tables (id, restaurant_id, table_number, capacity, is_active, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1, 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 2, 4, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 3, 6, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 4, 8, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  capacity = EXCLUDED.capacity,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert sample schedules
INSERT INTO restaurant_schedules (id, restaurant_id, day_of_week, open_time, close_time, is_active, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1, '12:00', '23:00', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 2, '12:00', '23:00', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 3, '12:00', '23:00', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 4, '12:00', '23:00', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 5, '12:00', '23:00', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 6, '12:00', '23:00', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 0, '12:00', '23:00', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  open_time = EXCLUDED.open_time,
  close_time = EXCLUDED.close_time,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
