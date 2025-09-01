-- Actualizar el check constraint para permitir el estado 'pending'
ALTER TABLE reservations DROP CONSTRAINT check_reservation_status;

-- Crear nuevo check constraint que incluya 'pending'
ALTER TABLE reservations ADD CONSTRAINT check_reservation_status 
CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text]));