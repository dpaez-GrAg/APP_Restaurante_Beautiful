-- ========================================
-- DATOS INICIALES DEL SISTEMA
-- ========================================
-- Este archivo contiene todos los datos iniciales necesarios
-- para el funcionamiento básico del sistema.

-- ========================================
-- RESTAURANT RESERVATION SYSTEM - SEED DATA
-- ========================================
-- This file contains comprehensive seed data for the restaurant system
-- Execute this AFTER running bootstrap_full.sql
-- Version: 2.0
-- Last updated: 2025-01-07

-- ========================================
-- RESTAURANT CONFIGURATION
-- ========================================

INSERT INTO public.restaurant_config (
    restaurant_name,
    hero_title,
    hero_subtitle,
    description,
    contact_phone,
    contact_email,
    contact_address,
    city,
    state,
    postcode,
    latitude,
    longitude,
    is_active
) VALUES (
    'Restaurante La Bella Vista',
    'Experiencia Gastronómica Única',
    'Donde cada plato cuenta una historia',
    'Un restaurante de alta cocina que combina tradición e innovación, ofreciendo una experiencia culinaria inolvidable en el corazón de la ciudad.',
    '+34 123 456 789',
    'reservas@labellavista.es',
    'Calle Gran Vía 123, Planta 5',
    'Madrid',
    'Madrid',
    '28013',
    40.4168,
    -3.7038,
    true
) ON CONFLICT DO NOTHING;

-- ========================================
-- RESTAURANT SCHEDULES (Weekly Hours)
-- ========================================

-- Monday to Thursday
INSERT INTO public.restaurant_schedules (day_of_week, opening_time, closing_time, is_active) VALUES
(1, '12:00', '23:30', true), -- Monday
(2, '12:00', '23:30', true), -- Tuesday  
(3, '12:00', '23:30', true), -- Wednesday
(4, '12:00', '23:30', true); -- Thursday

-- Friday and Saturday (extended hours)
INSERT INTO public.restaurant_schedules (day_of_week, opening_time, closing_time, is_active) VALUES
(5, '12:00', '01:00', true), -- Friday
(6, '12:00', '01:00', true); -- Saturday

-- Sunday (shorter hours)
INSERT INTO public.restaurant_schedules (day_of_week, opening_time, closing_time, is_active) VALUES
(0, '13:00', '22:00', true); -- Sunday

-- ========================================
-- TIME SLOTS
-- ========================================

-- Lunch service (12:00 - 16:30)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('12:00', 40),
('12:30', 40),
('13:00', 50),
('13:30', 50),
('14:00', 50),
('14:30', 45),
('15:00', 40),
('15:30', 35),
('16:00', 30),
('16:30', 25);

-- Dinner service (19:00 - 23:00)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('19:00', 30),
('19:30', 40),
('20:00', 50),
('20:30', 50),
('21:00', 50),
('21:30', 45),
('22:00', 40),
('22:30', 35),
('23:00', 30);

-- Late dinner (Friday/Saturday only)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('23:30', 25),
('00:00', 20),
('00:30', 15);

-- ========================================
-- TABLES
-- ========================================

-- Small tables (2 people)
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Mesa 1', 2, 1, 3, 1, 100, 100, 'circle', true),
('Mesa 2', 2, 1, 3, 1, 200, 100, 'circle', true),
('Mesa 3', 2, 1, 3, 1, 300, 100, 'circle', true),
('Mesa 4', 2, 1, 3, 1, 400, 100, 'circle', true),
('Mesa 5', 2, 1, 3, 1, 500, 100, 'circle', true);

-- Medium tables (4 people)
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Mesa 6', 4, 2, 6, 2, 100, 250, 'square', true),
('Mesa 7', 4, 2, 6, 2, 250, 250, 'square', true),
('Mesa 8', 4, 2, 6, 2, 400, 250, 'square', true),
('Mesa 9', 4, 2, 6, 2, 550, 250, 'square', true);

-- Large tables (6-8 people)
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Mesa 10', 6, 4, 8, 2, 150, 400, 'rectangle', true),
('Mesa 11', 6, 4, 8, 2, 350, 400, 'rectangle', true),
('Mesa 12', 8, 6, 10, 2, 200, 550, 'rectangle', true);

-- VIP/Private dining tables
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Sala Privada A', 10, 8, 12, 2, 600, 400, 'rectangle', true),
('Sala Privada B', 12, 10, 15, 3, 600, 550, 'rectangle', true);

-- Bar seating
INSERT INTO public.tables (name, capacity, min_capacity, max_capacity, extra_capacity, position_x, position_y, shape, is_active) VALUES
('Barra 1', 1, 1, 1, 0, 50, 50, 'circle', true),
('Barra 2', 1, 1, 1, 0, 100, 50, 'circle', true),
('Barra 3', 1, 1, 1, 0, 150, 50, 'circle', true),
('Barra 4', 1, 1, 1, 0, 200, 50, 'circle', true),
('Barra 5', 1, 1, 1, 0, 250, 50, 'circle', true),
('Barra 6', 1, 1, 1, 0, 300, 50, 'circle', true);

-- ========================================
-- TABLE COMBINATIONS
-- ========================================

-- Combinations for larger groups
INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Combinación Romántica (Mesas 1-2)',
    ARRAY[t1.id, t2.id],
    4,
    3,
    6,
    2,
    true
FROM public.tables t1, public.tables t2
WHERE t1.name = 'Mesa 1' AND t2.name = 'Mesa 2';

INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Grupo Familiar (Mesas 6-7)',
    ARRAY[t1.id, t2.id],
    8,
    6,
    12,
    4,
    true
FROM public.tables t1, public.tables t2
WHERE t1.name = 'Mesa 6' AND t2.name = 'Mesa 7';

INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Evento Grande (Mesas 10-11-12)',
    ARRAY[t1.id, t2.id, t3.id],
    20,
    16,
    26,
    6,
    true
FROM public.tables t1, public.tables t2, public.tables t3
WHERE t1.name = 'Mesa 10' AND t2.name = 'Mesa 11' AND t3.name = 'Mesa 12';

INSERT INTO public.table_combinations (name, table_ids, total_capacity, min_capacity, max_capacity, extra_capacity, is_active)
SELECT 
    'Área VIP Completa',
    ARRAY[t1.id, t2.id],
    22,
    18,
    27,
    5,
    true
FROM public.tables t1, public.tables t2
WHERE t1.name = 'Sala Privada A' AND t2.name = 'Sala Privada B';

-- ========================================
-- SAMPLE CUSTOMERS
-- ========================================

INSERT INTO public.customers (name, email, phone) VALUES
('María González', 'maria.gonzalez@email.com', '+34 600 111 222'),
('Carlos Rodríguez', 'carlos.rodriguez@email.com', '+34 600 333 444'),
('Ana López', 'ana.lopez@email.com', '+34 600 555 666'),
('José Martín', 'jose.martin@email.com', '+34 600 777 888'),
('Isabel Fernández', 'isabel.fernandez@email.com', '+34 600 999 000'),
('Miguel Sánchez', 'miguel.sanchez@email.com', '+34 611 111 222'),
('Carmen Pérez', 'carmen.perez@email.com', '+34 622 333 444'),
('Antonio García', 'antonio.garcia@email.com', '+34 633 555 666'),
('Rosa Jiménez', 'rosa.jimenez@email.com', '+34 644 777 888'),
('Francisco Ruiz', 'francisco.ruiz@email.com', '+34 655 999 000'),
('Pilar Moreno', 'pilar.moreno@email.com', '+34 666 111 222'),
('Rafael Muñoz', 'rafael.munoz@email.com', '+34 677 333 444'),
('Teresa Álvarez', 'teresa.alvarez@email.com', '+34 688 555 666'),
('Andrés Romero', 'andres.romero@email.com', '+34 699 777 888'),
('Cristina Torres', 'cristina.torres@email.com', '+34 600 123 456');

-- ========================================
-- SAMPLE RESERVATIONS (Next 30 days)
-- ========================================

-- Week 1: Current week reservations
DO $$
DECLARE
    customer_ids UUID[];
    table_ids UUID[];
    today_date DATE := CURRENT_DATE;
    i INTEGER;
    random_customer UUID;
    random_table UUID;
    random_time TIME;
    reservation_id UUID;
BEGIN
    -- Get customer IDs
    SELECT array_agg(id) INTO customer_ids FROM public.customers;
    
    -- Get table IDs  
    SELECT array_agg(id) INTO table_ids FROM public.tables WHERE capacity <= 4;
    
    -- Generate reservations for the next 7 days
    FOR i IN 0..6 LOOP
        -- 3-5 lunch reservations per day
        FOR j IN 1..(3 + floor(random() * 3)::integer) LOOP
            random_customer := customer_ids[1 + floor(random() * array_length(customer_ids, 1))::integer];
            random_table := table_ids[1 + floor(random() * array_length(table_ids, 1))::integer];
            random_time := ('13:00'::time + (floor(random() * 8) * interval '30 minutes'));
            
            INSERT INTO public.reservations (
                customer_id, date, time, guests, status, duration_minutes,
                start_at, end_at, special_requests
            ) VALUES (
                random_customer,
                today_date + i,
                random_time,
                2 + floor(random() * 3)::integer,
                CASE 
                    WHEN random() < 0.8 THEN 'confirmed'
                    WHEN random() < 0.95 THEN 'pending'
                    ELSE 'cancelled'
                END,
                90 + floor(random() * 60)::integer,
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid',
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid' + interval '2 hours',
                CASE 
                    WHEN random() < 0.3 THEN 'Mesa junto a la ventana por favor'
                    WHEN random() < 0.5 THEN 'Celebración de aniversario'
                    WHEN random() < 0.7 THEN 'Alergia a los frutos secos'
                    ELSE NULL
                END
            ) RETURNING id INTO reservation_id;
            
            -- Assign table
            INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
            VALUES (reservation_id, random_table);
        END LOOP;
        
        -- 4-7 dinner reservations per day
        FOR j IN 1..(4 + floor(random() * 4)::integer) LOOP
            random_customer := customer_ids[1 + floor(random() * array_length(customer_ids, 1))::integer];
            random_table := table_ids[1 + floor(random() * array_length(table_ids, 1))::integer];
            random_time := ('20:00'::time + (floor(random() * 6) * interval '30 minutes'));
            
            INSERT INTO public.reservations (
                customer_id, date, time, guests, status, duration_minutes,
                start_at, end_at, special_requests
            ) VALUES (
                random_customer,
                today_date + i,
                random_time,
                2 + floor(random() * 4)::integer,
                CASE 
                    WHEN random() < 0.85 THEN 'confirmed'
                    WHEN random() < 0.97 THEN 'pending'
                    ELSE 'cancelled'
                END,
                120 + floor(random() * 60)::integer,
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid',
                ((today_date + i)::text || ' ' || random_time::text)::timestamp AT TIME ZONE 'Europe/Madrid' + interval '2.5 hours',
                CASE 
                    WHEN random() < 0.2 THEN 'Mesa tranquila para una cita'
                    WHEN random() < 0.4 THEN 'Cumpleaños - postre especial'
                    WHEN random() < 0.6 THEN 'Cena de negocios'
                    ELSE NULL
                END
            ) RETURNING id INTO reservation_id;
            
            -- Assign table
            INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
            VALUES (reservation_id, random_table);
        END LOOP;
    END LOOP;
END $$;

-- ========================================
-- SPECIAL SCHEDULE EXAMPLES
-- ========================================

-- New Year's Eve special hours
INSERT INTO public.special_schedule_days (date, opening_time, closing_time, reason, is_active) VALUES
('2025-12-31', '19:00', '02:00', 'Nochevieja - Cena especial', true);

-- Valentine's Day special hours
INSERT INTO public.special_schedule_days (date, opening_time, closing_time, reason, is_active) VALUES
('2025-02-14', '18:00', '01:00', 'San Valentín - Cenas románticas', true);

-- ========================================
-- SPECIAL CLOSED DAYS EXAMPLES
-- ========================================

-- Christmas Day
INSERT INTO public.special_closed_days (date, is_range, reason) VALUES
('2025-12-25', false, 'Navidad - Cerrado por festividad');

-- Summer vacation range
INSERT INTO public.special_closed_days (date, is_range, range_start, range_end, reason) VALUES
('2025-08-01', true, '2025-08-01', '2025-08-15', 'Vacaciones de verano del personal');

-- Staff training day
INSERT INTO public.special_closed_days (date, is_range, reason) VALUES
('2025-03-15', false, 'Formación del personal - Cerrado');

-- ========================================
-- SAMPLE ADMIN USER PROFILE
-- ========================================

-- Note: This will only work if there's a user in auth.users with this ID
-- In a real scenario, this would be created through Supabase Auth
-- INSERT INTO public.profiles (id, email, full_name, role) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'admin@labellavista.es', 'Administrador Principal', 'admin');

-- ========================================
-- DATA VERIFICATION QUERIES
-- ========================================

-- Uncomment these to verify your data after seeding:

-- SELECT 'Restaurant Config' as section, count(*) as records FROM public.restaurant_config
-- UNION ALL
-- SELECT 'Schedules', count(*) FROM public.restaurant_schedules  
-- UNION ALL
-- SELECT 'Time Slots', count(*) FROM public.time_slots
-- UNION ALL
-- SELECT 'Tables', count(*) FROM public.tables
-- UNION ALL  
-- SELECT 'Table Combinations', count(*) FROM public.table_combinations
-- UNION ALL
-- SELECT 'Customers', count(*) FROM public.customers
-- UNION ALL
-- SELECT 'Reservations', count(*) FROM public.reservations
-- UNION ALL
-- SELECT 'Table Assignments', count(*) FROM public.reservation_table_assignments
-- ORDER BY section;

-- ========================================
-- SEED COMPLETION
-- ========================================

-- Seed data has been successfully inserted
-- The restaurant is now ready for testing with realistic data
-- You can start making reservations and testing all functionality