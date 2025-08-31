-- Fix RLS policies for customers table to allow public access for reservations
DROP POLICY IF EXISTS "Los usuarios autenticados pueden crear clientes" ON public.customers;
DROP POLICY IF EXISTS "Los usuarios autenticados pueden actualizar clientes" ON public.customers;
DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver clientes" ON public.customers;

-- Create policies that allow public access for reservation system
CREATE POLICY "Permitir creación de clientes para reservas" 
ON public.customers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir lectura de clientes para reservas" 
ON public.customers 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir actualización de clientes para reservas" 
ON public.customers 
FOR UPDATE 
USING (true);

-- Fix RLS policies for reservations table
DROP POLICY IF EXISTS "Los usuarios autenticados pueden crear reservas" ON public.reservations;
DROP POLICY IF EXISTS "Los usuarios autenticados pueden actualizar reservas" ON public.reservations;
DROP POLICY IF EXISTS "Los usuarios autenticados pueden ver reservas" ON public.reservations;

CREATE POLICY "Permitir creación de reservas públicas" 
ON public.reservations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir lectura de reservas públicas" 
ON public.reservations 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir actualización de reservas públicas" 
ON public.reservations 
FOR UPDATE 
USING (true);

-- Create table for time slots availability
CREATE TABLE IF NOT EXISTS public.time_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time time NOT NULL,
  max_capacity integer NOT NULL DEFAULT 50,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default time slots (15-minute intervals)
INSERT INTO public.time_slots (time, max_capacity) VALUES
('13:00', 50), ('13:15', 50), ('13:30', 50), ('13:45', 50),
('14:00', 50), ('14:15', 50), ('14:30', 50), ('14:45', 50),
('15:00', 50), ('15:15', 50), ('15:30', 50), ('15:45', 50),
('19:30', 50), ('19:45', 50), 
('20:00', 50), ('20:15', 50), ('20:30', 50), ('20:45', 50),
('21:00', 50), ('21:15', 50), ('21:30', 50), ('21:45', 50)
ON CONFLICT DO NOTHING;

-- Enable RLS on time_slots
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de horarios públicos" 
ON public.time_slots 
FOR SELECT 
USING (true);