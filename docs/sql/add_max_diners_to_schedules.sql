-- ========================================
-- ADD MAX_DINERS FIELD TO RESTAURANT_SCHEDULES
-- ========================================
-- Este script añade el campo max_diners a la tabla restaurant_schedules
-- para permitir configurar límites de comensales por turno

-- Añadir campo max_diners a restaurant_schedules
ALTER TABLE public.restaurant_schedules 
ADD COLUMN IF NOT EXISTS max_diners INTEGER;

-- Comentario para documentar el campo
COMMENT ON COLUMN public.restaurant_schedules.max_diners IS 'Número máximo de comensales permitidos para este turno/horario';

-- También añadir el campo a special_schedule_days para consistencia
ALTER TABLE public.special_schedule_days 
ADD COLUMN IF NOT EXISTS max_diners INTEGER;

COMMENT ON COLUMN public.special_schedule_days.max_diners IS 'Número máximo de comensales permitidos para este horario especial';

-- Actualizar valores por defecto (opcional - puedes ajustar según tus necesidades)
-- UPDATE public.restaurant_schedules SET max_diners = 50 WHERE max_diners IS NULL;
-- UPDATE public.special_schedule_days SET max_diners = 50 WHERE max_diners IS NULL;
