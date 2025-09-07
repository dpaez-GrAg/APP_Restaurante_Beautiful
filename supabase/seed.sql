-- Seed data for multi-tenant restaurant system
-- This creates example data for development/demo purposes

-- Insert demo business
INSERT INTO public.business (name, slug, phone, address, opening_hours)
VALUES (
    'Restaurante Demo',
    'demo',
    '+34 123 456 789',
    'Calle Principal 123, Madrid, España',
    '{
        "monday": {"open": "12:00", "close": "23:00"},
        "tuesday": {"open": "12:00", "close": "23:00"},
        "wednesday": {"open": "12:00", "close": "23:00"},
        "thursday": {"open": "12:00", "close": "23:00"},
        "friday": {"open": "12:00", "close": "00:00"},
        "saturday": {"open": "12:00", "close": "00:00"},
        "sunday": {"open": "12:00", "close": "22:00"}
    }'::jsonb
);

-- Get the business ID for foreign key references
DO $$
DECLARE
    demo_business_id UUID;
BEGIN
    SELECT id INTO demo_business_id FROM public.business WHERE slug = 'demo';
    
    -- Insert demo tables
    INSERT INTO public.tables (business_id, name, capacity, notes) VALUES
        (demo_business_id, 'Mesa 1', 4, 'Mesa junto a la ventana'),
        (demo_business_id, 'Mesa 2', 2, 'Mesa romántica para dos'),
        (demo_business_id, 'Mesa 3', 6, 'Mesa grande para grupos');
END $$;