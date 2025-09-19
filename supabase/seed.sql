-- Basic seed data for local development
-- This file will be loaded when running `supabase db reset`

-- Insert sample restaurant configuration
INSERT INTO restaurants (id, name, description, address, phone, email, capacity, created_at, updated_at) 
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

-- Insert sample schedules (Monday to Sunday)
INSERT INTO schedules (id, restaurant_id, day_of_week, open_time, close_time, is_active, created_at, updated_at)
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
